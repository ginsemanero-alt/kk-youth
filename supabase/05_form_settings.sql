-- =====================================================================
-- KK Youth Profiling System  |  05_form_settings.sql
-- Form settings: the Admin decides which optional fields are shown and
-- required on the self-registration form, the encoder form and the
-- Excel import. Enforced here in the database, not only in the browser.
-- Run FIFTH (after 04_form_fields_extra.sql). Safe to re-run: the
-- Admin's show/required choices are kept.
-- =====================================================================

-- ---------- Settings table -------------------------------------------
-- Core fields (first_name, last_name, birthdate, sex, purok_id,
-- education_status) are NOT listed: duplicate detection, the age bracket,
-- the dashboard and the OSY flag need them, so they are always shown and
-- always required.
create table if not exists public.form_fields (
  field_key    text primary key,
  label        text not null check (char_length(label) between 1 and 80),
  section      text not null check (section in ('personal', 'other')),
  is_visible   boolean not null default true,
  is_required  boolean not null default false,
  is_sensitive boolean not null default false,
  sort_order   int not null default 0,
  depends_on   text references public.form_fields(field_key),
  check (is_visible or not is_required)
);

-- Labels, sections and dependencies are refreshed on re-run; is_visible
-- and is_required are only set the first time (then they are the Admin's).
insert into public.form_fields (field_key, label, section, is_visible, is_required, is_sensitive, sort_order, depends_on) values
  ('middle_name',           'Middle name',                       'personal', true,  false, false,  10, null),
  ('suffix',                'Suffix',                            'personal', true,  false, false,  20, null),
  ('civil_status',          'Civil status',                      'personal', true,  false, false,  30, null),
  ('contact_number',        'Mobile number',                     'personal', true,  false, false,  40, null),
  ('email',                 'Email address',                     'personal', true,  false, false,  50, null),
  ('registered_voter',      'Registered SK voter',               'personal', true,  false, false,  60, null),
  ('religion',              'Religion',                          'personal', false, false, true,   70, null),
  ('education_level',       'Education level',                   'personal', true,  false, false,  80, null),
  ('course',                'Course',                            'personal', true,  false, false,  90, 'education_level'),
  ('out_of_school_reason',  'Reason for not attending school',   'personal', true,  false, false, 100, null),
  ('employment_status',     'Work status',                       'personal', true,  false, false, 110, null),
  ('employment_sector',     'Employment sector',                 'personal', true,  false, false, 120, 'employment_status'),
  ('government_agency',     'Government agency',                 'personal', true,  false, false, 130, 'employment_sector'),
  ('employment_duration',   'Length of employment',              'personal', true,  false, false, 140, 'employment_status'),
  ('has_disability',        'Person with disability (PWD)',      'other',    false, false, true,  200, null),
  ('has_medical_condition', 'Medical condition',                 'other',    false, false, true,  210, null),
  ('youth_org_member',      'Member of a youth organization',    'other',    true,  false, false, 220, null),
  ('skills',                'Skills',                            'other',    true,  false, false, 230, null),
  ('interests',             'Interests',                         'other',    true,  false, false, 240, null),
  ('civic_involvement',     'Civic involvement',                 'other',    true,  false, false, 250, null)
on conflict (field_key) do update
  set label = excluded.label, section = excluded.section, is_sensitive = excluded.is_sensitive,
      sort_order = excluded.sort_order, depends_on = excluded.depends_on;

-- ---------- Rules for changing a setting -----------------------------
create or replace function public.guard_form_field_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_child text; v_parent text;
begin
  if not new.is_visible then new.is_required := false; end if;   -- hidden is never required

  if old.is_visible and not new.is_visible then
    select label into v_child from public.form_fields
     where depends_on = new.field_key and is_visible and field_key <> new.field_key limit 1;
    if v_child is not null then
      raise exception 'Hide "%" first, because it depends on "%".', v_child, new.label using errcode = 'check_violation';
    end if;
  end if;

  if new.is_visible and not old.is_visible and new.depends_on is not null then
    select label into v_parent from public.form_fields where field_key = new.depends_on and not is_visible;
    if v_parent is not null then
      raise exception 'Show "%" first, because "%" depends on it.', v_parent, new.label using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists form_fields_guard on public.form_fields;
create trigger form_fields_guard before update on public.form_fields
  for each row execute function public.guard_form_field_change();

drop trigger if exists audit_form_fields on public.form_fields;
create trigger audit_form_fields after insert or update or delete on public.form_fields
  for each row execute function public.audit_row();

-- ---------- Privileges + RLS -----------------------------------------
revoke all on public.form_fields from anon, authenticated;
grant select on public.form_fields to anon, authenticated;          -- the public form needs the settings
grant update (is_visible, is_required) on public.form_fields to authenticated;

alter table public.form_fields enable row level security;

drop policy if exists "form fields read" on public.form_fields;
create policy "form fields read" on public.form_fields for select to anon, authenticated
  using (true);
drop policy if exists "form fields admin update" on public.form_fields;
create policy "form fields admin update" on public.form_fields for update to authenticated
  using ((select public.get_user_role()) = 'admin') with check ((select public.get_user_role()) = 'admin');
drop policy if exists "form fields no insert" on public.form_fields;
create policy "form fields no insert" on public.form_fields for insert to anon, authenticated
  with check (false);
drop policy if exists "form fields no delete" on public.form_fields;
create policy "form fields no delete" on public.form_fields for delete to anon, authenticated
  using (false);

-- ---------- Enforcing the settings on youth and registrations --------
-- Does a conditional field apply to this answer set? (same rules as the
-- clean_profile_extras() trigger in 04 and lib/formSettings.ts)
create or replace function public.form_field_applies(p_key text, j jsonb)
returns boolean language sql immutable as $$
  select coalesce(case p_key
    when 'course'               then j ->> 'education_level' in ('college', 'vocational', 'postgraduate', 'doctorate')
    when 'out_of_school_reason' then j ->> 'education_status' = 'out_of_school'
    when 'employment_sector'    then j ->> 'employment_status' = 'employed'
    when 'government_agency'    then j ->> 'employment_status' = 'employed' and j ->> 'employment_sector' = 'government'
    when 'employment_duration'  then j ->> 'employment_status' in ('employed', 'self_employed')
    else true end, false)
$$;

create or replace function public.is_blank_answer(v jsonb)
returns boolean language sql immutable as $$
  select v is null or v = 'null'::jsonb
      or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')
      or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0)
$$;

-- Hidden field: a new record gets no value; an edited record keeps the
-- value it already had (so changing the settings never alters old data).
-- Required field: a new record must answer it; an edit cannot blank it.
create or replace function public.apply_form_settings()
returns trigger language plpgsql security definer set search_path = public as $$
declare f record; j jsonb; o jsonb; patch jsonb := '{}';
begin
  -- approve_registration() turns this off: the registration was checked when it was submitted.
  if coalesce(current_setting('kk.form_rules', true), '') = 'off' then return new; end if;

  j := to_jsonb(new);
  if tg_op = 'UPDATE' then o := to_jsonb(old); end if;

  for f in select field_key from public.form_fields where not is_visible loop
    if j ? f.field_key then
      patch := patch || jsonb_build_object(f.field_key,
        case when tg_op = 'UPDATE' then coalesce(o -> f.field_key, 'null'::jsonb)
             when jsonb_typeof(j -> f.field_key) = 'array' then '[]'::jsonb
             else 'null'::jsonb end);
    end if;
  end loop;
  if patch <> '{}'::jsonb then
    new := jsonb_populate_record(new, patch);
    j := to_jsonb(new);
  end if;

  for f in select field_key, label from public.form_fields where is_visible and is_required order by sort_order loop
    if j ? f.field_key
       and public.form_field_applies(f.field_key, j)
       and public.is_blank_answer(j -> f.field_key)
       and (tg_op = 'INSERT' or (j -> f.field_key) is distinct from (o -> f.field_key)) then
      raise exception 'Required field: %.', f.label using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end $$;

-- Trigger names sort before youth_extras / pending_extras / pending_prepare,
-- so hidden values are removed before the conditional clean-up and before
-- the phone number is encrypted.
drop trigger if exists youth_apply_form_settings on public.youth;
create trigger youth_apply_form_settings before insert or update on public.youth
  for each row execute function public.apply_form_settings();
drop trigger if exists pending_apply_form_settings on public.pending_registrations;
create trigger pending_apply_form_settings before insert on public.pending_registrations
  for each row execute function public.apply_form_settings();

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
