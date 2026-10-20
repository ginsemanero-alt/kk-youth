-- =====================================================================
-- KK Youth Profiling System  |  08_viewer_aggregate_only.sql
-- Role-based access for the Viewer: aggregate statistics only.
--   * summary_report(): counts by purok, age group, sex, education, work
--     and the non-sensitive custom questions, for every signed-in role.
--     For Viewers, counts of 1 or 2 are shown as "<3" so a small group
--     cannot point to one person.
--   * log_access_denied(): records when a signed-in user opens a page their
--     role is not allowed to see.
-- The policies that keep Viewers away from individual rows are in
-- 02_security.sql ("youth read", "attendance read") and 06_custom_questions.sql
-- (youth_custom_answers), where those objects are defined.
-- Run EIGHTH (after 07_user_management.sql). Safe to re-run.
-- =====================================================================

-- ---------- Small-count suppression ----------------------------------
-- Viewers get "<3" instead of 1 or 2. Admin and Encoder get the real number.
create or replace function public.report_count(p_n bigint)
returns jsonb language sql stable set search_path = public as $$
  select case when p_n between 1 and 2 and public.get_user_role() = 'viewer' then to_jsonb('<3'::text) else to_jsonb(p_n) end
$$;
revoke all on function public.report_count(bigint) from public, anon;
grant execute on function public.report_count(bigint) to authenticated;

-- ---------- Summary report (aggregate only) --------------------------
-- Active (not deleted) youth only. Optional filters: purok and age bracket.
create or replace function public.summary_report(p_purok uuid default null, p_bracket text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if public.get_user_role() is null then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;
  if p_bracket is not null and p_bracket not in ('15-17', '18-24', '25-30') then
    raise exception 'Unknown age bracket.';
  end if;

  with b as (
    select y.*, p.name as purok_name, public.age_bracket(public.calc_age(y.birthdate)) as bracket
    from public.youth y join public.puroks p on p.id = y.purok_id
    where y.deleted_at is null
      and (p_purok is null or y.purok_id = p_purok)
      and (p_bracket is null or public.age_bracket(public.calc_age(y.birthdate)) = p_bracket)
  ),
  g as (   -- one row per (group, value) with its count
    select 'sex' as grp, sex::text as k, count(*) as n from b group by 2
    union all select 'age_bracket', bracket, count(*) from b group by 2
    union all select 'purok', purok_name, count(*) from b group by 2
    union all select 'education_status', education_status::text, count(*) from b group by 2
    union all select 'education_level', education_level::text, count(*) from b group by 2
    union all select 'employment_status', employment_status::text, count(*) from b group by 2
    union all select 'civil_status', civil_status::text, count(*) from b group by 2
    union all select 'registered_voter', case registered_voter when true then 'yes' when false then 'no' end, count(*) from b group by 2
    union all select 'youth_org_member', case youth_org_member when true then 'yes' when false then 'no' end, count(*) from b group by 2
    union all select 'osy_by_purok', purok_name, count(*) from b where education_status = 'out_of_school' group by 2
    union all select 'osy_by_level', education_level::text, count(*) from b where education_status = 'out_of_school' group by 2
    union all select 'osy_by_employment', employment_status::text, count(*) from b where education_status = 'out_of_school' group by 2
  )
  select jsonb_build_object(
    'total', public.report_count((select count(*) from b)),
    'osy',   public.report_count((select count(*) from b where education_status = 'out_of_school')),
    'masked', public.get_user_role() = 'viewer',
    'groups', (select coalesce(jsonb_object_agg(grp, items), '{}') from (
                 select grp, jsonb_agg(jsonb_build_object('label', k, 'count', public.report_count(n)) order by n desc, k) as items
                 from g group by grp) x),
    -- Choose-one and yes/no questions that are active and not sensitive.
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
                     'id', q.id, 'label', q.label, 'type', q.question_type,
                     'counts', (select coalesce(jsonb_agg(jsonb_build_object('label', a, 'count', public.report_count(n)) order by n desc, a), '[]')
                                from (select coalesce(case when q.question_type = 'yes_no'
                                                           then case b.custom_answers ->> q.id::text when 'true' then 'Yes' when 'false' then 'No' end
                                                           else b.custom_answers ->> q.id::text end, 'Not answered') as a,
                                             count(*) as n
                                      from b group by 1) z)
                   ) order by q.sort_order, q.created_at), '[]')
                  from public.custom_questions q
                  where q.is_active and not q.is_sensitive and q.question_type in ('single_choice', 'yes_no'))
  ) into v;
  return v;
end $$;
revoke all on function public.summary_report(uuid, text) from public, anon;
grant execute on function public.summary_report(uuid, text) to authenticated;

-- ---------- Denied page access in the audit log ----------------------
-- Adds 'denied' to the allowed audit actions (the check from 01_schema.sql plus 'denied').
alter table public.audit_logs drop constraint if exists audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
  check (action in ('insert', 'update', 'delete', 'restore', 'view', 'export', 'approve', 'reject', 'purge', 'denied'));

-- Called by the server when a signed-in user opens a page their role may not see. At most one
-- entry per user and page per minute, so the log cannot be flooded. Records only the page path
-- and the role, nothing else.
create or replace function public.log_access_denied(p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role public.app_role; v_name text; v_path text := left(coalesce(p_path, ''), 120);
begin
  if auth.uid() is null then raise exception 'Not allowed.' using errcode = 'insufficient_privilege'; end if;
  if exists (select 1 from public.audit_logs
             where actor_id = auth.uid() and action = 'denied' and detail ->> 'path' = v_path
               and created_at > now() - interval '1 minute') then
    return;
  end if;
  select role, full_name into v_role, v_name from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, detail)
  values (auth.uid(), v_name, 'denied', 'route', jsonb_build_object('path', v_path, 'role', v_role));
end $$;
revoke all on function public.log_access_denied(text) from public, anon;
grant execute on function public.log_access_denied(text) to authenticated;
