-- =====================================================================
-- KK Youth Profiling System  |  06_custom_questions.sql
-- The Admin's own questions (custom questions) on the self-registration
-- form, the encoder form and the Excel import. Answers are validated
-- here in the database. Sensitive answers follow the same rules as
-- religion / disability / medical (04): Admin and Encoder only, exported
-- only by an Admin, never written to the audit log.
-- Run SIXTH (after 05_form_settings.sql). Safe to re-run.
-- =====================================================================

-- ---------- Questions ------------------------------------------------
create table if not exists public.custom_questions (
  id            uuid primary key default gen_random_uuid(),
  label         text not null check (char_length(btrim(label)) between 1 and 200),
  help_text     text check (help_text is null or char_length(help_text) <= 300),
  question_type text not null check (question_type in ('text', 'single_choice', 'multi_choice', 'yes_no')),
  options       text[] not null default '{}',
  is_required   boolean not null default false,
  is_active     boolean not null default true,
  is_sensitive  boolean not null default false,
  sort_order    int not null default 0,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists custom_questions_order_idx on public.custom_questions (sort_order, created_at);

-- Clean the options; choice questions need 2 to 20 distinct options, the others none.
create or replace function public.prepare_custom_question()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_opt text;
begin
  new.label := btrim(regexp_replace(new.label, '\s+', ' ', 'g'));
  new.help_text := public.clean_text(new.help_text);
  if new.question_type in ('single_choice', 'multi_choice') then
    select coalesce(array_agg(o order by n), '{}') into new.options
    from (select public.clean_text(x) o, min(n) n from unnest(new.options) with ordinality t(x, n)
          where public.clean_text(x) is not null group by 1) s;
    if coalesce(array_length(new.options, 1), 0) not between 2 and 20 then
      raise exception 'A choice question needs 2 to 20 different options.' using errcode = 'check_violation';
    end if;
    foreach v_opt in array new.options loop
      if char_length(v_opt) > 100 then raise exception 'Each option can have at most 100 characters.' using errcode = 'check_violation'; end if;
    end loop;
  else
    new.options := '{}';
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.created_by := auth.uid(); end if;
    new.created_at := now();
  else
    -- The type and the sensitive flag are fixed once the question exists: old answers
    -- must stay valid, and values already in the audit log cannot be masked afterwards.
    if new.question_type is distinct from old.question_type or new.is_sensitive is distinct from old.is_sensitive then
      raise exception 'The type and the sensitive setting of a question cannot be changed. Deactivate it and create a new question.'
        using errcode = 'check_violation';
    end if;
    new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists custom_questions_prepare on public.custom_questions;
create trigger custom_questions_prepare before insert or update on public.custom_questions
  for each row execute function public.prepare_custom_question();

-- No hard delete, even from the SQL editor: deactivate instead (old answers stay readable).
create or replace function public.block_custom_question_delete()
returns trigger language plpgsql as $$
begin raise exception 'Questions cannot be deleted. Deactivate the question instead.'; end $$;
drop trigger if exists custom_questions_no_delete on public.custom_questions;
create trigger custom_questions_no_delete before delete on public.custom_questions
  for each row execute function public.block_custom_question_delete();

drop trigger if exists audit_custom_questions on public.custom_questions;
create trigger audit_custom_questions after insert or update on public.custom_questions
  for each row execute function public.audit_row();

-- ---------- Privileges + RLS -----------------------------------------
revoke all on public.custom_questions from anon, authenticated;
grant select on public.custom_questions to anon, authenticated;
grant insert (label, help_text, question_type, options, is_required, is_active, is_sensitive, sort_order)
  on public.custom_questions to authenticated;
grant update (label, help_text, options, is_required, is_active, sort_order) on public.custom_questions to authenticated;

alter table public.custom_questions enable row level security;

drop policy if exists "questions public read active" on public.custom_questions;
create policy "questions public read active" on public.custom_questions for select to anon
  using (is_active);
-- Signed-in staff also read inactive questions, so old answers can still be labelled.
drop policy if exists "questions staff read" on public.custom_questions;
create policy "questions staff read" on public.custom_questions for select to authenticated
  using (is_active or (select public.get_user_role()) is not null);
drop policy if exists "questions admin insert" on public.custom_questions;
create policy "questions admin insert" on public.custom_questions for insert to authenticated
  with check ((select public.get_user_role()) = 'admin');
drop policy if exists "questions admin update" on public.custom_questions;
create policy "questions admin update" on public.custom_questions for update to authenticated
  using ((select public.get_user_role()) = 'admin') with check ((select public.get_user_role()) = 'admin');
drop policy if exists "questions no delete" on public.custom_questions;
create policy "questions no delete" on public.custom_questions for delete to anon, authenticated
  using (false);

-- ---------- Answers --------------------------------------------------
-- { "<question id>": answer }. text -> string, single_choice -> string,
-- multi_choice -> array of strings, yes_no -> boolean.
alter table public.youth                 add column if not exists custom_answers jsonb not null default '{}';
alter table public.pending_registrations add column if not exists custom_answers jsonb not null default '{}';
do $$ begin
  alter table public.youth add constraint youth_custom_answers_object check (jsonb_typeof(custom_answers) = 'object');
  exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.pending_registrations add constraint pending_custom_answers_object check (jsonb_typeof(custom_answers) = 'object');
  exception when duplicate_object then null; end $$;

-- The new column is not readable through youth (private.grant_youth_select leaves it out).
select private.grant_youth_select();

create or replace function public.validate_custom_answers()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  q record; v jsonb; o jsonb := '{}'; v_out jsonb := '{}'; v_key text; x jsonb; v_txt text; v_has_sensitive boolean := false;
  v_old_sensitive boolean := false;
begin
  if new.custom_answers is null or jsonb_typeof(new.custom_answers) <> 'object' then new.custom_answers := '{}'; end if;
  -- approve_registration(): the answers were checked when the registration was submitted.
  if coalesce(current_setting('kk.form_rules', true), '') = 'off' then return new; end if;
  if tg_op = 'UPDATE' then o := coalesce(old.custom_answers, '{}'); end if;

  for v_key in select jsonb_object_keys(new.custom_answers) loop
    if not exists (select 1 from public.custom_questions where id::text = v_key) then
      raise exception 'Unknown question in custom answers.' using errcode = 'check_violation';
    end if;
  end loop;

  for q in select * from public.custom_questions order by sort_order, created_at loop
    v := new.custom_answers -> q.id::text;
    if not q.is_active then
      -- A deactivated question is not asked any more: new records get no answer, saved answers are kept.
      if o ? q.id::text then v_out := v_out || jsonb_build_object(q.id::text, o -> q.id::text); end if;
      continue;
    end if;

    -- Normalise and treat empty as unanswered.
    if v is not null and jsonb_typeof(v) = 'string' then
      v_txt := public.clean_text(v #>> '{}');
      v := case when v_txt is null then null else to_jsonb(v_txt) end;
    elsif v is not null and jsonb_typeof(v) = 'array' then
      if jsonb_array_length(v) = 0 then v := null; end if;
    elsif v = 'null'::jsonb then
      v := null;
    end if;

    if v is null then
      if q.is_required and (tg_op = 'INSERT' or o ? q.id::text) then
        raise exception 'Required question: %', q.label using errcode = 'check_violation';
      end if;
      continue;
    end if;

    -- Check only new or changed answers, so an option removed later does not block edits.
    if tg_op = 'INSERT' or v is distinct from (o -> q.id::text) then
      if q.question_type = 'text' then
        if jsonb_typeof(v) <> 'string' then raise exception 'Answer to "%" must be text.', q.label using errcode = 'check_violation'; end if;
        if char_length(v #>> '{}') > 300 then raise exception 'Answer to "%" can have at most 300 characters.', q.label using errcode = 'check_violation'; end if;
      elsif q.question_type = 'yes_no' then
        if jsonb_typeof(v) <> 'boolean' then raise exception 'Answer to "%" must be yes or no.', q.label using errcode = 'check_violation'; end if;
      elsif q.question_type = 'single_choice' then
        if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(q.options)) then
          raise exception 'Answer to "%" must be one of the listed options.', q.label using errcode = 'check_violation';
        end if;
      elsif q.question_type = 'multi_choice' then
        if jsonb_typeof(v) <> 'array' then raise exception 'Answer to "%" must be a list of options.', q.label using errcode = 'check_violation'; end if;
        for x in select * from jsonb_array_elements(v) loop
          if jsonb_typeof(x) <> 'string' or not ((x #>> '{}') = any(q.options)) then
            raise exception 'Answer to "%" must use only the listed options.', q.label using errcode = 'check_violation';
          end if;
        end loop;
        select jsonb_agg(distinct e) into v from jsonb_array_elements(v) e;
      end if;
    end if;

    if q.is_sensitive then
      v_has_sensitive := true;
      if o ? q.id::text then v_old_sensitive := true; end if;
    end if;
    v_out := v_out || jsonb_build_object(q.id::text, v);
  end loop;

  -- Same consent rule as religion / disability / medical (04).
  if v_has_sensitive and not v_old_sensitive and new.consent_version not like '%-SPI' then
    raise exception 'Answers to sensitive questions need the updated consent (version ending in -SPI).' using errcode = 'check_violation';
  end if;

  new.custom_answers := v_out;
  return new;
end $$;

drop trigger if exists youth_custom_answers on public.youth;
create trigger youth_custom_answers before insert or update on public.youth
  for each row execute function public.validate_custom_answers();
drop trigger if exists pending_custom_answers on public.pending_registrations;
create trigger pending_custom_answers before insert on public.pending_registrations
  for each row execute function public.validate_custom_answers();

-- ---------- Reading answers ------------------------------------------
-- Keep only the answers whose question is (or is not) sensitive.
create or replace function public.filter_custom_answers(p_answers jsonb, p_sensitive boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}')
  from jsonb_each(coalesce(p_answers, '{}')) e
  join public.custom_questions q on q.id::text = e.key
  where q.is_sensitive = p_sensitive
$$;
-- Views check function privileges against the caller, so signed-in users may run it. It
-- only filters the answers it is given; it cannot read anyone's answers by itself.
revoke all on function public.filter_custom_answers(jsonb, boolean) from public, anon;
grant execute on function public.filter_custom_answers(jsonb, boolean) to authenticated;

-- Runs with the owner's rights (API roles cannot read youth.custom_answers) and repeats the
-- row rules of the "youth read" policy. sensitive_answers is null for everyone but Admin and Encoder.
create or replace view public.youth_custom_answers with (security_barrier = true) as
select y.id,
       public.filter_custom_answers(y.custom_answers, false) as answers,
       case when (select public.get_user_role()) in ('admin', 'encoder')
            then public.filter_custom_answers(y.custom_answers, true) end as sensitive_answers
from public.youth y
where (select public.get_user_role()) is not null
  and (y.deleted_at is null or (select public.get_user_role()) = 'admin');
revoke all on public.youth_custom_answers from public, anon, authenticated;
grant select on public.youth_custom_answers to authenticated;

-- Bulk read of sensitive answers for exports: Admin only, logged (row count only).
create or replace function public.get_sensitive_answers_bulk(p_ids uuid[])
returns table (id uuid, sensitive_answers jsonb)
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if (select public.get_user_role()) is distinct from 'admin' then
    raise exception 'Not allowed. Only an Admin can export sensitive information.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 5000 then raise exception 'Too many rows.'; end if;
  select full_name into v_name from public.profiles where profiles.id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, detail)
  values (auth.uid(), v_name, 'view', 'youth_custom_answers', jsonb_build_object('rows', coalesce(array_length(p_ids, 1), 0), 'purpose', 'export'));
  return query
    select y.id, public.filter_custom_answers(y.custom_answers, true) from public.youth y where y.id = any(p_ids);
end $$;
revoke all on function public.get_sensitive_answers_bulk(uuid[]) from public, anon;
grant execute on function public.get_sensitive_answers_bulk(uuid[]) to authenticated;

-- ---------- Approval and import carry the answers --------------------
-- Same as 04_form_fields_extra.sql, plus custom_answers.
create or replace function public.approve_registration(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.pending_registrations; v_id uuid; v_name text;
begin
  if (select public.get_user_role()) is null or (select public.get_user_role()) not in ('admin', 'encoder') then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.pending_registrations where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'This registration is no longer pending.'; end if;

  -- The registration was checked against the form settings and questions when it was
  -- submitted; later changes must not block or alter it.
  perform set_config('kk.form_rules', 'off', true);
  begin
    insert into public.youth (first_name, middle_name, last_name, suffix, birthdate, sex, civil_status, purok_id,
      education_status, education_level, employment_status, skills, interests, civic_involvement,
      consent_version, consent_at, consent_source, guardian_name, guardian_relationship, guardian_consent_at,
      email, registered_voter, civil_status_other, course, out_of_school_reason, employment_sector, employment_duration,
      government_agency, youth_org_member, youth_org_name, religion, has_disability, disability_details,
      has_medical_condition, medical_details, custom_answers)
    values (r.first_name, r.middle_name, r.last_name, r.suffix, r.birthdate, r.sex, r.civil_status, r.purok_id,
      r.education_status, r.education_level, r.employment_status, r.skills, r.interests, r.civic_involvement,
      r.consent_version, r.consent_at, 'self_registration', r.guardian_name, r.guardian_relationship,
      case when r.guardian_name is not null then r.consent_at end,
      r.email, r.registered_voter, r.civil_status_other, r.course, r.out_of_school_reason, r.employment_sector, r.employment_duration,
      r.government_agency, r.youth_org_member, r.youth_org_name, r.religion, r.has_disability, r.disability_details,
      r.has_medical_condition, r.medical_details, r.custom_answers)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Duplicate: a profile with the same name and birthdate already exists.';
  end;
  perform set_config('kk.form_rules', 'on', true);

  if r.contact_enc is not null then
    insert into public.youth_contacts (youth_id, contact_enc) values (v_id, r.contact_enc);
  end if;
  update public.pending_registrations
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), youth_id = v_id, contact_enc = null
   where id = p_id;

  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, record_id, detail)
  values (auth.uid(), v_name, 'approve', 'pending_registrations', p_id::text, jsonb_build_object('youth_id', v_id));
  return v_id;
end $$;

create or replace function public.import_youth(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb; v_i int := 0; v_results jsonb := '[]'; v_id uuid; v_purok uuid; v_name text;
  v_ok int := 0; v_fail int := 0; v_spi boolean; v_answers jsonb;
begin
  if (select public.get_user_role()) is null or (select public.get_user_role()) not in ('admin', 'encoder') then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'Send an array of at most 500 rows per request.';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_i := v_i + 1;
    begin
      select id into v_purok from public.puroks
       where deleted_at is null and lower(btrim(name)) = lower(btrim(v_row ->> 'purok'));
      if v_purok is null then raise exception 'Unknown purok "%"', coalesce(v_row ->> 'purok', ''); end if;
      v_answers := case when jsonb_typeof(v_row -> 'custom_answers') = 'object' then v_row -> 'custom_answers' else '{}' end;
      v_spi := nullif(btrim(coalesce(v_row ->> 'religion', '')), '') is not null
            or nullif(btrim(coalesce(v_row ->> 'has_disability', '')), '') is not null
            or nullif(btrim(coalesce(v_row ->> 'has_medical_condition', '')), '') is not null
            or public.filter_custom_answers(v_answers, true) <> '{}'::jsonb;

      insert into public.youth (first_name, middle_name, last_name, suffix, birthdate, sex, civil_status, purok_id,
        education_status, education_level, employment_status, skills, interests, civic_involvement,
        consent_version, consent_at, consent_source, guardian_name, guardian_relationship, guardian_consent_at,
        email, registered_voter, civil_status_other, course, out_of_school_reason, employment_sector, employment_duration,
        government_agency, youth_org_member, youth_org_name, religion, has_disability, disability_details,
        has_medical_condition, medical_details, custom_answers)
      values (
        v_row ->> 'first_name', v_row ->> 'middle_name', v_row ->> 'last_name', v_row ->> 'suffix',
        (v_row ->> 'birthdate')::date, (v_row ->> 'sex')::public.sex_type,
        nullif(v_row ->> 'civil_status', '')::public.civil_status_type, v_purok,
        (v_row ->> 'education_status')::public.education_status_type,
        nullif(v_row ->> 'education_level', '')::public.education_level_type,
        nullif(v_row ->> 'employment_status', '')::public.employment_status_type,
        coalesce(array(select jsonb_array_elements_text(v_row -> 'skills')), '{}'),
        coalesce(array(select jsonb_array_elements_text(v_row -> 'interests')), '{}'),
        coalesce(array(select jsonb_array_elements_text(v_row -> 'civic_involvement')), '{}'),
        'import-' || to_char(now(), 'YYYYMMDD') || case when v_spi then '-SPI' else '' end, now(), 'import',
        v_row ->> 'guardian_name', v_row ->> 'guardian_relationship',
        case when nullif(btrim(coalesce(v_row ->> 'guardian_name', '')), '') is not null then now() end,
        v_row ->> 'email', public.parse_yes_no(v_row ->> 'registered_voter'), v_row ->> 'civil_status_other',
        v_row ->> 'course', v_row ->> 'out_of_school_reason',
        nullif(v_row ->> 'employment_sector', '')::public.employment_sector_type, v_row ->> 'employment_duration',
        v_row ->> 'government_agency', public.parse_yes_no(v_row ->> 'youth_org_member'), v_row ->> 'youth_org_name',
        v_row ->> 'religion', public.parse_yes_no(v_row ->> 'has_disability'), v_row ->> 'disability_details',
        public.parse_yes_no(v_row ->> 'has_medical_condition'), v_row ->> 'medical_details', v_answers)
      returning id into v_id;

      if nullif(btrim(coalesce(v_row ->> 'contact_number', '')), '') is not null then
        insert into public.youth_contacts (youth_id, contact_enc)
        values (v_id, private.encrypt_text(left(btrim(v_row ->> 'contact_number'), 20)));
      end if;
      v_ok := v_ok + 1;
      v_results := v_results || jsonb_build_object('row', v_i, 'ok', true, 'id', v_id);
    exception
      when unique_violation then
        v_fail := v_fail + 1;
        v_results := v_results || jsonb_build_object('row', v_i, 'ok', false, 'error', 'Duplicate: same name and birthdate already exists.');
      when others then
        v_fail := v_fail + 1;
        v_results := v_results || jsonb_build_object('row', v_i, 'ok', false, 'error', sqlerrm);
    end;
  end loop;

  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, detail)
  values (auth.uid(), v_name, 'insert', 'youth', jsonb_build_object('source', 'excel_import', 'imported', v_ok, 'failed', v_fail));
  return jsonb_build_object('imported', v_ok, 'failed', v_fail, 'results', v_results);
end $$;

revoke all on function public.approve_registration(uuid) from public, anon;
grant execute on function public.approve_registration(uuid) to authenticated;
revoke all on function public.import_youth(jsonb) from public, anon;
grant execute on function public.import_youth(jsonb) to authenticated;

-- ---------- Safety net (same check as the end of 02_security.sql) -----
do $$
declare t record;
begin
  for t in
    select c.relname, c.relrowsecurity,
           (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as n_policies
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    if not t.relrowsecurity or t.n_policies = 0 then
      raise exception 'Table public.% has no RLS or no policy', t.relname;
    end if;
  end loop;
end $$;
