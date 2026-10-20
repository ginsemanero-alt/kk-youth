-- =====================================================================
-- KK Youth Profiling System  |  all_in_one.sql   (GENERATED, do not edit)
-- 01_schema.sql, 02_security.sql, 04_form_fields_extra.sql, 05_form_settings.sql, 06_custom_questions.sql, 07_user_management.sql, 08_viewer_aggregate_only.sql in order, in one file.
-- Paste the whole file into Supabase Dashboard > SQL Editor and click Run.
-- Safe to re-run. Sample puroks (03_seed.sql) are not included.
-- Rebuild with: npm run sql:bundle
-- =====================================================================

-- >>>>>>>>>>>>>>>>>>>> 01_schema.sql <<<<<<<<<<<<<<<<<<<<

-- =====================================================================
-- KK Youth Profiling System  |  01_schema.sql
-- Tables, enums, indexes, validation triggers, encryption helpers, views.
-- Run FIRST in: Supabase Dashboard > SQL Editor. Safe to re-run.
-- Prerequisite: Dashboard > Database > Extensions: "pgcrypto" and "supabase_vault" enabled
-- (both are enabled by default on new Supabase projects).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Enums ----------------------------------------------------
do $$ begin
  create type public.app_role           as enum ('admin', 'encoder', 'viewer');
  exception when duplicate_object then null; end $$;
do $$ begin
  create type public.sex_type           as enum ('male', 'female');
  exception when duplicate_object then null; end $$;
do $$ begin
  create type public.civil_status_type  as enum ('single', 'married', 'widowed', 'separated', 'live_in');
  exception when duplicate_object then null; end $$;
do $$ begin
  create type public.education_status_type as enum ('in_school', 'out_of_school', 'graduated');
  exception when duplicate_object then null; end $$;
do $$ begin
  create type public.education_level_type as enum
    ('elementary', 'junior_high', 'senior_high', 'alternative_learning', 'vocational', 'college', 'postgraduate');
  exception when duplicate_object then null; end $$;
do $$ begin
  create type public.employment_status_type as enum ('employed', 'self_employed', 'unemployed');
  exception when duplicate_object then null; end $$;
do $$ begin
  create type public.registration_status_type as enum ('pending', 'approved', 'rejected');
  exception when duplicate_object then null; end $$;

-- ---------- Private schema (never exposed through the API) -----------
create schema if not exists private;
revoke all on schema private from public;

-- Encryption key lives in Supabase Vault, not in the code or the client.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'kk_contact_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'kk_contact_key',
      'Key used to encrypt youth contact numbers (pgp_sym_encrypt)');
  end if;
end $$;

create or replace function private.contact_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'kk_contact_key' limit 1
$$;

create or replace function private.encrypt_text(p_text text)
returns bytea language sql stable security definer set search_path = '' as $$
  select extensions.pgp_sym_encrypt(p_text, private.contact_key())
$$;

create or replace function private.decrypt_text(p_data bytea)
returns text language sql stable security definer set search_path = '' as $$
  select extensions.pgp_sym_decrypt(p_data, private.contact_key())
$$;

-- ---------- Core tables ----------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        public.app_role not null default 'viewer',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.puroks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create unique index if not exists puroks_name_unique on public.puroks (lower(btrim(name))) where deleted_at is null;

create sequence if not exists public.youth_code_seq;

create table if not exists public.youth (
  id               uuid primary key default gen_random_uuid(),
  youth_code       text not null unique
                     default ('KK-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.youth_code_seq')::text, 5, '0')),
  first_name       text not null check (char_length(btrim(first_name)) between 1 and 80),
  middle_name      text check (middle_name is null or char_length(middle_name) <= 80),
  last_name        text not null check (char_length(btrim(last_name)) between 1 and 80),
  suffix           text check (suffix is null or char_length(suffix) <= 10),
  birthdate        date not null,
  sex              public.sex_type not null,
  civil_status     public.civil_status_type not null default 'single',
  purok_id         uuid not null references public.puroks(id),
  education_status public.education_status_type not null,
  education_level  public.education_level_type,
  employment_status public.employment_status_type not null default 'unemployed',
  skills           text[] not null default '{}',
  interests        text[] not null default '{}',
  civic_involvement text[] not null default '{}',
  -- Data Privacy Act: consent record
  consent_version  text not null,
  consent_at       timestamptz not null,
  consent_source   text not null default 'form' check (consent_source in ('form', 'self_registration', 'import')),
  guardian_name         text check (guardian_name is null or char_length(guardian_name) <= 120),
  guardian_relationship text check (guardian_relationship is null or char_length(guardian_relationship) <= 60),
  guardian_consent_at   timestamptz,
  consent_scan_path     text,
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles(id) on delete set null,
  check (array_length(skills, 1) is null or array_length(skills, 1) <= 30),
  check (array_length(interests, 1) is null or array_length(interests, 1) <= 30),
  check (array_length(civic_involvement, 1) is null or array_length(civic_involvement, 1) <= 30)
);
-- Duplicate detection: same name + birthdate cannot exist twice among active profiles.
create unique index if not exists youth_no_duplicates on public.youth
  (lower(btrim(first_name)), lower(btrim(last_name)), coalesce(lower(btrim(middle_name)), ''), birthdate)
  where deleted_at is null;
create index if not exists youth_purok_idx      on public.youth (purok_id) where deleted_at is null;
create index if not exists youth_birthdate_idx  on public.youth (birthdate) where deleted_at is null;
create index if not exists youth_education_idx  on public.youth (education_status) where deleted_at is null;
create index if not exists youth_employment_idx on public.youth (employment_status) where deleted_at is null;
create index if not exists youth_name_idx       on public.youth (lower(last_name), lower(first_name));

-- Encrypted contact numbers are kept apart from the profile (data segregation).
create table if not exists public.youth_contacts (
  youth_id    uuid primary key references public.youth(id) on delete cascade,
  contact_enc bytea not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.activities (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  description   text check (description is null or char_length(description) <= 1000),
  category      text not null default 'other'
                  check (category in ('sports', 'education', 'health', 'environment', 'livelihood', 'governance', 'culture', 'other')),
  activity_date date not null,
  venue         text check (venue is null or char_length(venue) <= 160),
  purok_id      uuid references public.puroks(id),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists activities_date_idx on public.activities (activity_date desc) where deleted_at is null;

create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.activities(id) on delete cascade,
  youth_id     uuid not null references public.youth(id) on delete cascade,
  recorded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (activity_id, youth_id)
);
create index if not exists attendance_youth_idx on public.attendance (youth_id);

-- Public self-registration inbox (anon may INSERT only; nobody but staff can read).
create table if not exists public.pending_registrations (
  id            uuid primary key default gen_random_uuid(),
  first_name    text not null check (char_length(btrim(first_name)) between 1 and 80),
  middle_name   text check (middle_name is null or char_length(middle_name) <= 80),
  last_name     text not null check (char_length(btrim(last_name)) between 1 and 80),
  suffix        text check (suffix is null or char_length(suffix) <= 10),
  birthdate     date not null,
  sex           public.sex_type not null,
  civil_status  public.civil_status_type not null default 'single',
  purok_id      uuid not null references public.puroks(id),
  contact_number text check (contact_number is null or char_length(contact_number) <= 20),  -- transient: encrypted then nulled by trigger
  contact_enc   bytea,
  education_status public.education_status_type not null,
  education_level  public.education_level_type,
  employment_status public.employment_status_type not null default 'unemployed',
  skills        text[] not null default '{}',
  interests     text[] not null default '{}',
  civic_involvement text[] not null default '{}',
  consent_version text not null,
  consent_at    timestamptz not null default now(),
  guardian_name text check (guardian_name is null or char_length(guardian_name) <= 120),
  guardian_relationship text check (guardian_relationship is null or char_length(guardian_relationship) <= 60),
  status        public.registration_status_type not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 300),
  youth_id      uuid references public.youth(id) on delete set null,
  created_at    timestamptz not null default now(),
  check (array_length(skills, 1) is null or array_length(skills, 1) <= 30),
  check (array_length(interests, 1) is null or array_length(interests, 1) <= 30),
  check (array_length(civic_involvement, 1) is null or array_length(civic_involvement, 1) <= 30)
);
create index if not exists pending_status_idx on public.pending_registrations (status, created_at desc);

-- Append-only audit trail.
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_name  text,
  action      text not null check (action in ('insert', 'update', 'delete', 'restore', 'view', 'export', 'approve', 'reject', 'purge')),
  table_name  text not null,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_table_idx   on public.audit_logs (table_name, record_id);

create table if not exists public.settings_note (
  id int primary key default 1 check (id = 1),
  retention_note text not null
);
insert into public.settings_note (id, retention_note) values
  (1, 'Soft-deleted youth records are kept for 365 days for recovery, then purged by an Admin using purge_soft_deleted(). Audit logs are retained for 3 years.')
on conflict (id) do nothing;

-- ---------- Pure helper functions ------------------------------------
create or replace function public.calc_age(p_birthdate date, p_on date default current_date)
returns int language sql immutable as $$
  select date_part('year', age(p_on, p_birthdate))::int
$$;

-- Common national youth grouping: 15-17 child youth, 18-24 core youth, 25-30 young adult.
create or replace function public.age_bracket(p_age int)
returns text language sql immutable as $$
  select case when p_age between 15 and 17 then '15-17'
              when p_age between 18 and 24 then '18-24'
              when p_age between 25 and 30 then '25-30'
              else 'Outside 15-30' end
$$;

-- Suggested referrals for out-of-school youth. Informational only.
create or replace function public.suggest_referrals(
  p_age int, p_edu public.education_status_type,
  p_level public.education_level_type, p_emp public.employment_status_type)
returns text[] language plpgsql immutable as $$
declare r text[] := '{}';
begin
  if p_edu <> 'out_of_school' then return r; end if;
  if p_level is null or p_level in ('elementary', 'junior_high', 'senior_high') then
    r := array_append(r, 'DepEd Alternative Learning System (ALS) to complete basic education');
  end if;
  if p_age between 15 and 17 then
    r := array_append(r, 'Barangay Council for the Protection of Children (BCPC) for case follow-up');
  end if;
  if p_age >= 18 then
    r := array_append(r, case when p_emp = 'unemployed'
                   then 'TESDA technical-vocational training and scholarship programs'
                   else 'TESDA skills upgrading and national certification (NC) assessment' end);
  end if;
  if p_emp = 'unemployed' and p_age >= 18 then
    r := array_append(r, 'PESO job matching and DOLE youth employment programs');
  end if;
  return r;
end $$;

-- ---------- Trigger functions (validation, normalization) ------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.clean_list(p_list text[])
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct lower(btrim(x))) filter (where btrim(x) <> ''), '{}')
  from unnest(coalesce(p_list, '{}')) x
$$;

create or replace function public.validate_youth_row()
returns trigger language plpgsql as $$
declare v_age int; v_age_at_consent int;
begin
  new.first_name  := btrim(regexp_replace(new.first_name, '\s+', ' ', 'g'));
  new.last_name   := btrim(regexp_replace(new.last_name, '\s+', ' ', 'g'));
  new.middle_name := nullif(btrim(regexp_replace(coalesce(new.middle_name, ''), '\s+', ' ', 'g')), '');
  new.suffix      := nullif(btrim(coalesce(new.suffix, '')), '');
  new.skills      := public.clean_list(new.skills);
  new.interests   := public.clean_list(new.interests);
  new.civic_involvement := public.clean_list(new.civic_involvement);
  new.guardian_name := nullif(btrim(coalesce(new.guardian_name, '')), '');

  if tg_op = 'INSERT' or new.birthdate is distinct from old.birthdate then
    v_age := public.calc_age(new.birthdate);
    if new.birthdate > current_date or v_age < 15 or v_age > 30 then
      raise exception 'Youth must be between 15 and 30 years old (computed age: %).', v_age
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'INSERT' or new.consent_at is distinct from old.consent_at
     or new.guardian_name is distinct from old.guardian_name or new.birthdate is distinct from old.birthdate then
    v_age_at_consent := public.calc_age(new.birthdate, new.consent_at::date);
    if v_age_at_consent < 18 and (new.guardian_name is null or new.guardian_consent_at is null) then
      raise exception 'Parent or guardian consent is required for youth below 18.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists youth_validate on public.youth;
create trigger youth_validate before insert or update on public.youth
  for each row execute function public.validate_youth_row();
drop trigger if exists youth_touch on public.youth;
create trigger youth_touch before update on public.youth
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Self-registration: encrypt the contact number immediately, force safe defaults.
create or replace function public.prepare_pending_registration()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare v_age int;
begin
  new.first_name  := btrim(regexp_replace(new.first_name, '\s+', ' ', 'g'));
  new.last_name   := btrim(regexp_replace(new.last_name, '\s+', ' ', 'g'));
  new.middle_name := nullif(btrim(regexp_replace(coalesce(new.middle_name, ''), '\s+', ' ', 'g')), '');
  new.skills      := public.clean_list(new.skills);
  new.interests   := public.clean_list(new.interests);
  new.civic_involvement := public.clean_list(new.civic_involvement);
  new.guardian_name := nullif(btrim(coalesce(new.guardian_name, '')), '');

  v_age := public.calc_age(new.birthdate);
  if new.birthdate > current_date or v_age < 15 or v_age > 30 then
    raise exception 'Registration is open to youth aged 15 to 30 only.' using errcode = 'check_violation';
  end if;
  if v_age < 18 and new.guardian_name is null then
    raise exception 'Parent or guardian name is required for youth below 18.' using errcode = 'check_violation';
  end if;

  if nullif(btrim(coalesce(new.contact_number, '')), '') is not null then
    new.contact_enc := private.encrypt_text(btrim(new.contact_number));
  end if;
  new.contact_number := null;               -- plaintext is never stored
  new.status := 'pending';
  new.reviewed_by := null; new.reviewed_at := null; new.rejection_reason := null; new.youth_id := null;
  new.consent_at := now();                  -- server time, not client time
  return new;
end $$;

drop trigger if exists pending_prepare on public.pending_registrations;
create trigger pending_prepare before insert on public.pending_registrations
  for each row execute function public.prepare_pending_registration();

-- ---------- Views (security_invoker => RLS of the caller applies) ----
-- Dropped first because 04_form_fields_extra.sql adds columns to this view
-- (a plain "create or replace" cannot remove them again). unreached_youth()
-- is recreated below; run 02 and 04 to 06 again after re-running this file.
drop view if exists public.youth_overview cascade;
create view public.youth_overview with (security_invoker = true) as
select
  y.id, y.youth_code, y.first_name, y.middle_name, y.last_name, y.suffix,
  concat_ws(' ', y.first_name, nullif(left(y.middle_name, 1) || '.', '.'), y.last_name, y.suffix) as full_name,
  y.birthdate,
  public.calc_age(y.birthdate) as age,
  public.age_bracket(public.calc_age(y.birthdate)) as age_bracket,
  y.sex, y.civil_status, y.purok_id, p.name as purok_name,
  y.education_status, y.education_level, y.employment_status,
  y.skills, y.interests, y.civic_involvement,
  (y.education_status = 'out_of_school') as is_osy,
  public.suggest_referrals(public.calc_age(y.birthdate), y.education_status, y.education_level, y.employment_status) as referrals,
  y.consent_version, y.consent_at, y.consent_source, y.guardian_name, y.guardian_relationship,
  y.guardian_consent_at, y.consent_scan_path,
  y.created_at, y.updated_at, y.deleted_at
from public.youth y
join public.puroks p on p.id = y.purok_id;

-- activity_stats (attendance counts and participation rate per activity) is defined in
-- 02_security.sql, because it checks the caller's role with get_user_role().

-- Youth with no recorded attendance (optionally only counting events since a date).
create or replace function public.unreached_youth(p_since date default null)
returns setof public.youth_overview
language sql stable as $$
  select o.* from public.youth_overview o
  where o.deleted_at is null
    and not exists (
      select 1 from public.attendance t
      join public.activities a on a.id = t.activity_id and a.deleted_at is null
      where t.youth_id = o.id and (p_since is null or a.activity_date >= p_since))
  order by o.last_name, o.first_name
$$;

-- Aggregates are computed in SQL, not in the browser. Aggregate only, for every signed-in role
-- (Viewers included): it runs with the owner's rights because Viewers cannot read individual
-- youth rows, and it refuses callers without an active role.
create or replace function public.dashboard_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if public.get_user_role() is null then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;
  with y as (select * from public.youth_overview where deleted_at is null)
  select jsonb_build_object(
    'total',        (select count(*) from y),
    'osy',          (select count(*) from y where is_osy),
    'in_school',    (select count(*) from y where education_status = 'in_school'),
    'out_of_school',(select count(*) from y where education_status = 'out_of_school'),
    'graduated',    (select count(*) from y where education_status = 'graduated'),
    'employed',     (select count(*) from y where employment_status in ('employed', 'self_employed')),
    'unemployed',   (select count(*) from y where employment_status = 'unemployed'),
    'male',         (select count(*) from y where sex = 'male'),
    'female',       (select count(*) from y where sex = 'female'),
    'age_brackets', (select coalesce(jsonb_agg(jsonb_build_object('label', b.label, 'count', coalesce(c.n, 0)) order by b.label), '[]')
                       from (values ('15-17'), ('18-24'), ('25-30')) b(label)
                       left join (select age_bracket, count(*) n from y group by 1) c on c.age_bracket = b.label),
    'employment',   (select coalesce(jsonb_agg(jsonb_build_object('label', employment_status, 'count', n)), '[]')
                       from (select employment_status, count(*) n from y group by 1) q),
    'puroks',       (select coalesce(jsonb_agg(jsonb_build_object('label', p.name, 'count', coalesce(c.n, 0)) order by p.name), '[]')
                       from public.puroks p
                       left join (select purok_id, count(*) n from y group by 1) c on c.purok_id = p.id
                       where p.deleted_at is null),
    'top_skills',   (select coalesce(jsonb_agg(jsonb_build_object('label', s, 'count', n)), '[]')
                       from (select s, count(*) n from y, unnest(skills) s group by s order by n desc, s limit 8) q),
    'top_interests',(select coalesce(jsonb_agg(jsonb_build_object('label', s, 'count', n)), '[]')
                       from (select s, count(*) n from y, unnest(interests) s group by s order by n desc, s limit 8) q),
    'activities',   (select count(*) from public.activities where deleted_at is null),
    'avg_participation', (select coalesce(round(avg(participation_rate), 1), 0) from public.activity_stats),
    'unreached',    (select count(*) from public.unreached_youth(null))
  ) into v;
  return v;
end $$;

-- >>>>>>>>>>>>>>>>>>>> 02_security.sql <<<<<<<<<<<<<<<<<<<<

-- =====================================================================
-- KK Youth Profiling System  |  02_security.sql
-- Roles, Row Level Security, audit triggers, secure RPCs, private storage.
-- Run SECOND (after 01_schema.sql). Safe to re-run.
-- =====================================================================

-- ---------- Role helper (the ONLY source of truth for roles) ---------
-- Reads the role from public.profiles for the signed-in user. The client can never send a role.
create or replace function public.get_user_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;
revoke all on function public.get_user_role() from public, anon;
grant execute on function public.get_user_role() to authenticated;

-- ---------- New auth user -> profile (always 'viewer') ---------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'viewer')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, role)
select id, coalesce(raw_user_meta_data ->> 'full_name', ''), 'viewer' from auth.users
on conflict (id) do nothing;

-- Roles can only be changed by an admin (or from the SQL editor / service role, where auth.uid() is null).
create or replace function public.guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
       and public.get_user_role() is distinct from 'admin' then
      raise exception 'Only an Admin can change roles or account status.' using errcode = 'insufficient_privilege';
    end if;
    if new.id = auth.uid() and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
      raise exception 'You cannot change your own role or deactivate your own account.' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- ---------- Actor stamping + delete guards ---------------------------
create or replace function public.stamp_actor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    else
      new.updated_by := auth.uid();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists youth_stamp on public.youth;
create trigger youth_stamp before insert or update on public.youth
  for each row execute function public.stamp_actor();

create or replace function public.stamp_creator()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.created_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists activities_stamp on public.activities;
create trigger activities_stamp before insert on public.activities
  for each row execute function public.stamp_creator();

create or replace function public.stamp_recorder()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.recorded_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists attendance_stamp on public.attendance;
create trigger attendance_stamp before insert on public.attendance
  for each row execute function public.stamp_recorder();

-- Only Admin can soft-delete / restore a youth profile.
create or replace function public.guard_youth_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is distinct from old.deleted_at and auth.uid() is not null then
    if public.get_user_role() is distinct from 'admin' then
      raise exception 'Only an Admin can delete or restore youth records.' using errcode = 'insufficient_privilege';
    end if;
    new.deleted_by := case when new.deleted_at is null then null else auth.uid() end;
  end if;
  return new;
end $$;
drop trigger if exists youth_delete_guard on public.youth;
create trigger youth_delete_guard before update on public.youth
  for each row execute function public.guard_youth_delete();

-- A purok that still has active youth cannot be removed.
create or replace function public.guard_purok_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null
     and exists (select 1 from public.youth where purok_id = new.id and deleted_at is null) then
    raise exception 'This purok still has youth records. Move them to another purok first.';
  end if;
  return new;
end $$;
drop trigger if exists purok_delete_guard on public.puroks;
create trigger purok_delete_guard before update on public.puroks
  for each row execute function public.guard_purok_delete();

-- ---------- Audit trail (filled by triggers, append-only) ------------
-- Sensitive personal information (religion, disability, medical; columns
-- added by 04_form_fields_extra.sql) and answers to sensitive custom
-- questions (06_custom_questions.sql) are never written to the log: the log
-- only says that such a field was set or changed.
create or replace function public.audit_mask(p_data jsonb, p_marker text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k text; v_answers jsonb;
begin
  if p_data is null then return null; end if;
  foreach k in array array['religion', 'has_disability', 'disability_details', 'has_medical_condition', 'medical_details'] loop
    if p_data ? k and p_data -> k <> 'null'::jsonb then
      p_data := jsonb_set(p_data, array[k], to_jsonb(p_marker));
    end if;
  end loop;
  if jsonb_typeof(p_data -> 'custom_answers') = 'object' then
    -- An answer is kept only when its question is known and not sensitive.
    select coalesce(jsonb_object_agg(e.key, case when q.is_sensitive is false then e.value else to_jsonb(p_marker) end), '{}')
      into v_answers
      from jsonb_each(p_data -> 'custom_answers') e
      left join public.custom_questions q on q.id::text = e.key;
    p_data := jsonb_set(p_data, '{custom_answers}', v_answers);
  end if;
  return p_data;
end $$;

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'contact_enc' - 'contact_number' end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'contact_enc' - 'contact_number' end;
  v_action text := lower(tg_op);
  v_changed_old jsonb := '{}'; v_changed_new jsonb := '{}'; k text;
  v_id text;
  v_name text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k not in ('updated_at', 'updated_by') and (v_old -> k) is distinct from (v_new -> k) then
        v_changed_old := v_changed_old || jsonb_build_object(k, v_old -> k);
        v_changed_new := v_changed_new || jsonb_build_object(k, v_new -> k);
      end if;
    end loop;
    if v_changed_new = '{}'::jsonb then return new; end if;   -- nothing meaningful changed
    if v_changed_new ? 'deleted_at' then
      v_action := case when v_new ->> 'deleted_at' is null then 'restore' else 'delete' end;
    end if;
    v_old := v_changed_old; v_new := v_changed_new;
  end if;
  v_old := public.audit_mask(v_old, '[sensitive]');
  v_new := public.audit_mask(v_new, case when tg_op = 'UPDATE' then '[sensitive: changed]' else '[sensitive]' end);

  v_id := coalesce((coalesce(to_jsonb(new), to_jsonb(old))) ->> 'id', (coalesce(to_jsonb(new), to_jsonb(old))) ->> 'youth_id',
                   (coalesce(to_jsonb(new), to_jsonb(old))) ->> 'field_key');
  select full_name into v_name from public.profiles where id = auth.uid();

  insert into public.audit_logs (actor_id, actor_name, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), coalesce(nullif(v_name, ''), case when auth.uid() is null then 'system / public form' end),
          v_action, tg_table_name, v_id, v_old, v_new);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['youth', 'puroks', 'activities', 'attendance', 'profiles'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop;
end $$;
-- Self-registrations: log the submission only (approve/reject are logged by their RPCs).
drop trigger if exists audit_pending_registrations on public.pending_registrations;
create trigger audit_pending_registrations after insert on public.pending_registrations
  for each row execute function public.audit_row();

create or replace function public.audit_block_mutation()
returns trigger language plpgsql as $$
begin raise exception 'audit_logs is append-only.'; end $$;
drop trigger if exists audit_logs_immutable on public.audit_logs;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.audit_block_mutation();

-- ---------- Aggregate view: activity_stats ---------------------------
-- Attendance counts and participation rate per activity (no names), for every signed-in role,
-- Viewers included. It runs with the owner's rights because Viewers cannot read youth or
-- attendance rows themselves (see the policies below), and it checks the caller's role itself.
drop view if exists public.activity_stats cascade;
create view public.activity_stats with (security_invoker = false, security_barrier = true) as
select
  a.id, a.title, a.category, a.activity_date, a.venue, a.purok_id,
  (select count(*) from public.attendance t join public.youth y on y.id = t.youth_id and y.deleted_at is null
     where t.activity_id = a.id)::int as attendees,
  (select count(*) from public.youth y where y.deleted_at is null)::int as total_youth,
  case when (select count(*) from public.youth y where y.deleted_at is null) = 0 then 0
       else round(100.0 * (select count(*) from public.attendance t join public.youth y on y.id = t.youth_id and y.deleted_at is null
                           where t.activity_id = a.id)
                  / (select count(*) from public.youth y where y.deleted_at is null), 1) end as participation_rate
from public.activities a
where a.deleted_at is null
  and (select public.get_user_role()) is not null;

-- ---------- Table privileges (least privilege) -----------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.puroks to anon;                           -- needed for the public form dropdown
grant insert on public.pending_registrations to anon;            -- insert only, no read
grant select, insert, update on public.puroks to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, role, is_active) on public.profiles to authenticated;
grant insert, update on public.youth to authenticated;          -- SELECT is column-level, see below
grant select, insert, update on public.activities to authenticated;
grant select, insert, delete on public.attendance to authenticated;
grant select, update on public.pending_registrations to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.youth_overview, public.activity_stats to authenticated;
grant select on public.settings_note to authenticated;
grant usage on sequence public.youth_code_seq to authenticated;
-- youth_contacts: no direct grants. Only the secure RPCs below touch it.

-- youth SELECT is granted per column so the sensitive columns (added by
-- 04_form_fields_extra.sql) stay unreadable for every API role, including
-- Viewers. Admin and Encoder read them through the youth_sensitive view.
-- Later SQL files call this again after they add columns.
create or replace function private.grant_youth_select()
returns void language plpgsql as $$
declare v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'youth'
    and column_name not in ('religion', 'has_disability', 'disability_details', 'has_medical_condition', 'medical_details',
                            'custom_answers');
  execute 'revoke select on public.youth from authenticated';
  execute format('grant select (%s) on public.youth to authenticated', v_cols);
end $$;
revoke all on function private.grant_youth_select() from public;
select private.grant_youth_select();

-- ---------- Row Level Security ---------------------------------------
alter table public.profiles              enable row level security;
alter table public.puroks                enable row level security;
alter table public.youth                 enable row level security;
alter table public.youth_contacts        enable row level security;
alter table public.activities            enable row level security;
alter table public.attendance            enable row level security;
alter table public.pending_registrations enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.settings_note         enable row level security;

-- profiles
drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or (select public.get_user_role()) = 'admin');
drop policy if exists "profiles update admin" on public.profiles;
create policy "profiles update admin" on public.profiles for update to authenticated
  using ((select public.get_user_role()) = 'admin') with check ((select public.get_user_role()) = 'admin');

-- puroks
drop policy if exists "puroks public read" on public.puroks;
create policy "puroks public read" on public.puroks for select to anon using (deleted_at is null);
drop policy if exists "puroks staff read" on public.puroks;
create policy "puroks staff read" on public.puroks for select to authenticated
  using ((select public.get_user_role()) is not null and (deleted_at is null or (select public.get_user_role()) = 'admin'));
drop policy if exists "puroks admin insert" on public.puroks;
create policy "puroks admin insert" on public.puroks for insert to authenticated
  with check ((select public.get_user_role()) = 'admin');
drop policy if exists "puroks admin update" on public.puroks;
create policy "puroks admin update" on public.puroks for update to authenticated
  using ((select public.get_user_role()) = 'admin') with check ((select public.get_user_role()) = 'admin');

-- youth
drop policy if exists "youth read" on public.youth;
-- Individual youth rows are for Admin and Encoder only. Viewers get aggregates through
-- dashboard_summary(), activity_stats and summary_report() (08), never individual rows.
create policy "youth read" on public.youth for select to authenticated
  using ((select public.get_user_role()) in ('admin', 'encoder') and (deleted_at is null or (select public.get_user_role()) = 'admin'));
drop policy if exists "youth insert staff" on public.youth;
create policy "youth insert staff" on public.youth for insert to authenticated
  with check ((select public.get_user_role()) in ('admin', 'encoder'));
drop policy if exists "youth update staff" on public.youth;
create policy "youth update staff" on public.youth for update to authenticated
  using ((select public.get_user_role()) in ('admin', 'encoder') and (deleted_at is null or (select public.get_user_role()) = 'admin'))
  with check ((select public.get_user_role()) in ('admin', 'encoder'));
-- (no DELETE policy: hard delete is impossible from the API; soft delete only)

-- youth_contacts: explicit deny. Access only through get_youth_contact / set_youth_contact.
drop policy if exists "contacts no direct access" on public.youth_contacts;
create policy "contacts no direct access" on public.youth_contacts for all to authenticated using (false) with check (false);

-- activities
drop policy if exists "activities read" on public.activities;
create policy "activities read" on public.activities for select to authenticated
  using ((select public.get_user_role()) is not null and deleted_at is null);
drop policy if exists "activities insert staff" on public.activities;
create policy "activities insert staff" on public.activities for insert to authenticated
  with check ((select public.get_user_role()) in ('admin', 'encoder'));
drop policy if exists "activities update staff" on public.activities;
create policy "activities update staff" on public.activities for update to authenticated
  using ((select public.get_user_role()) in ('admin', 'encoder')) with check ((select public.get_user_role()) in ('admin', 'encoder'));

-- attendance
drop policy if exists "attendance read" on public.attendance;
-- Who attended is individual data: Admin and Encoder only (Viewers see counts through activity_stats).
create policy "attendance read" on public.attendance for select to authenticated
  using ((select public.get_user_role()) in ('admin', 'encoder'));
drop policy if exists "attendance insert staff" on public.attendance;
create policy "attendance insert staff" on public.attendance for insert to authenticated
  with check ((select public.get_user_role()) in ('admin', 'encoder'));
drop policy if exists "attendance delete staff" on public.attendance;
create policy "attendance delete staff" on public.attendance for delete to authenticated
  using ((select public.get_user_role()) in ('admin', 'encoder'));

-- pending_registrations: anon can INSERT only, staff review
drop policy if exists "pending anon insert" on public.pending_registrations;
create policy "pending anon insert" on public.pending_registrations for insert to anon
  with check (status = 'pending');
drop policy if exists "pending staff read" on public.pending_registrations;
create policy "pending staff read" on public.pending_registrations for select to authenticated
  using ((select public.get_user_role()) in ('admin', 'encoder'));
drop policy if exists "pending staff update" on public.pending_registrations;
create policy "pending staff update" on public.pending_registrations for update to authenticated
  using ((select public.get_user_role()) in ('admin', 'encoder'))
  with check ((select public.get_user_role()) in ('admin', 'encoder'));

-- audit_logs: admin read only; no insert/update/delete policy for any API role
drop policy if exists "audit admin read" on public.audit_logs;
create policy "audit admin read" on public.audit_logs for select to authenticated
  using ((select public.get_user_role()) = 'admin');

-- settings_note
drop policy if exists "settings read" on public.settings_note;
create policy "settings read" on public.settings_note for select to authenticated
  using ((select public.get_user_role()) is not null);

-- ---------- Secure RPCs ----------------------------------------------
create or replace function public.log_event(p_action text, p_table text, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if (select public.get_user_role()) is null then raise exception 'Not allowed.' using errcode = 'insufficient_privilege'; end if;
  if p_action not in ('view', 'export') then raise exception 'Unsupported audit action.'; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, detail)
  values (auth.uid(), v_name, p_action, left(p_table, 60), p_detail);
end $$;

create or replace function public.get_youth_contact(p_youth uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_enc bytea; v_name text;
begin
  if (select public.get_user_role()) not in ('admin', 'encoder') or (select public.get_user_role()) is null then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;
  select contact_enc into v_enc from public.youth_contacts where youth_id = p_youth;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, record_id, detail)
  values (auth.uid(), v_name, 'view', 'youth_contacts', p_youth::text, jsonb_build_object('field', 'contact_number'));
  if v_enc is null then return null; end if;
  return private.decrypt_text(v_enc);
end $$;

create or replace function public.set_youth_contact(p_youth uuid, p_contact text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if (select public.get_user_role()) is null or (select public.get_user_role()) not in ('admin', 'encoder') then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.youth where id = p_youth and deleted_at is null) then
    raise exception 'Youth record not found.';
  end if;
  if nullif(btrim(coalesce(p_contact, '')), '') is null then
    delete from public.youth_contacts where youth_id = p_youth;
  else
    if char_length(p_contact) > 20 then raise exception 'Contact number is too long.'; end if;
    insert into public.youth_contacts (youth_id, contact_enc) values (p_youth, private.encrypt_text(btrim(p_contact)))
    on conflict (youth_id) do update set contact_enc = excluded.contact_enc, updated_at = now();
  end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, record_id, detail)
  values (auth.uid(), v_name, 'update', 'youth_contacts', p_youth::text, jsonb_build_object('field', 'contact_number', 'changed', true));
end $$;

create or replace function public.approve_registration(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.pending_registrations; v_id uuid; v_name text;
begin
  if (select public.get_user_role()) is null or (select public.get_user_role()) not in ('admin', 'encoder') then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.pending_registrations where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'This registration is no longer pending.'; end if;

  begin
    insert into public.youth (first_name, middle_name, last_name, suffix, birthdate, sex, civil_status, purok_id,
      education_status, education_level, employment_status, skills, interests, civic_involvement,
      consent_version, consent_at, consent_source, guardian_name, guardian_relationship, guardian_consent_at)
    values (r.first_name, r.middle_name, r.last_name, r.suffix, r.birthdate, r.sex, r.civil_status, r.purok_id,
      r.education_status, r.education_level, r.employment_status, r.skills, r.interests, r.civic_involvement,
      r.consent_version, r.consent_at, 'self_registration', r.guardian_name, r.guardian_relationship,
      case when r.guardian_name is not null then r.consent_at end)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Duplicate: a profile with the same name and birthdate already exists.';
  end;

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

create or replace function public.reject_registration(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_status public.registration_status_type;
begin
  if (select public.get_user_role()) is null or (select public.get_user_role()) not in ('admin', 'encoder') then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;
  select status into v_status from public.pending_registrations where id = p_id for update;
  if v_status is distinct from 'pending' then raise exception 'This registration is no longer pending.'; end if;
  update public.pending_registrations
     set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
         rejection_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 300), contact_enc = null
   where id = p_id;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, record_id, detail)
  values (auth.uid(), v_name, 'reject', 'pending_registrations', p_id::text, jsonb_build_object('reason', p_reason));
end $$;

-- Bulk import: returns one result object per row so the UI can build an error report.
create or replace function public.import_youth(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb; v_i int := 0; v_results jsonb := '[]'; v_id uuid; v_purok uuid; v_name text;
  v_ok int := 0; v_fail int := 0;
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

      insert into public.youth (first_name, middle_name, last_name, suffix, birthdate, sex, civil_status, purok_id,
        education_status, education_level, employment_status, skills, interests, civic_involvement,
        consent_version, consent_at, consent_source, guardian_name, guardian_relationship, guardian_consent_at)
      values (
        v_row ->> 'first_name', v_row ->> 'middle_name', v_row ->> 'last_name', v_row ->> 'suffix',
        (v_row ->> 'birthdate')::date, (v_row ->> 'sex')::public.sex_type,
        coalesce(nullif(v_row ->> 'civil_status', ''), 'single')::public.civil_status_type, v_purok,
        (v_row ->> 'education_status')::public.education_status_type,
        nullif(v_row ->> 'education_level', '')::public.education_level_type,
        coalesce(nullif(v_row ->> 'employment_status', ''), 'unemployed')::public.employment_status_type,
        coalesce(array(select jsonb_array_elements_text(v_row -> 'skills')), '{}'),
        coalesce(array(select jsonb_array_elements_text(v_row -> 'interests')), '{}'),
        coalesce(array(select jsonb_array_elements_text(v_row -> 'civic_involvement')), '{}'),
        'import-' || to_char(now(), 'YYYYMMDD'), now(), 'import',
        v_row ->> 'guardian_name', v_row ->> 'guardian_relationship',
        case when nullif(btrim(coalesce(v_row ->> 'guardian_name', '')), '') is not null then now() end)
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

-- Retention: permanently remove youth that were soft-deleted long ago (Admin only).
create or replace function public.purge_soft_deleted(p_older_than_days int default 365)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int; v_name text;
begin
  if (select public.get_user_role()) is distinct from 'admin' then
    raise exception 'Only an Admin can purge records.' using errcode = 'insufficient_privilege';
  end if;
  if p_older_than_days < 30 then raise exception 'Minimum retention is 30 days.'; end if;
  with gone as (
    delete from public.youth where deleted_at is not null and deleted_at < now() - make_interval(days => p_older_than_days)
    returning id)
  select count(*) into v_n from gone;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, detail)
  values (auth.uid(), v_name, 'purge', 'youth', jsonb_build_object('older_than_days', p_older_than_days, 'removed', v_n));
  return v_n;
end $$;

-- Lock down who may call each function.
do $$
declare f text;
begin
  foreach f in array array[
    'log_event(text,text,jsonb)', 'get_youth_contact(uuid)', 'set_youth_contact(uuid,text)',
    'approve_registration(uuid)', 'reject_registration(uuid,text)', 'import_youth(jsonb)',
    'purge_soft_deleted(int)', 'dashboard_summary()', 'unreached_youth(date)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- Private Storage bucket for consent scans -----------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consent-scans', 'consent-scans', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

drop policy if exists "consent scans staff read" on storage.objects;
create policy "consent scans staff read" on storage.objects for select to authenticated
  using (bucket_id = 'consent-scans' and (select public.get_user_role()) in ('admin', 'encoder'));
drop policy if exists "consent scans staff upload" on storage.objects;
create policy "consent scans staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'consent-scans' and (select public.get_user_role()) in ('admin', 'encoder'));
drop policy if exists "consent scans staff update" on storage.objects;
create policy "consent scans staff update" on storage.objects for update to authenticated
  using (bucket_id = 'consent-scans' and (select public.get_user_role()) in ('admin', 'encoder'));
drop policy if exists "consent scans admin delete" on storage.objects;
create policy "consent scans admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'consent-scans' and (select public.get_user_role()) = 'admin');

-- ---------- Safety net: every public table must have RLS + a policy --
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

-- >>>>>>>>>>>>>>>>>>>> 04_form_fields_extra.sql <<<<<<<<<<<<<<<<<<<<

-- =====================================================================
-- KK Youth Profiling System  |  04_form_fields_extra.sql
-- Fields from the paper SK "Youth Profile Form" that were not yet in the
-- system: email, registered SK voter, civil status "others", course,
-- out-of-school reason, employment sector / duration / agency, youth
-- organization, and the SENSITIVE fields (religion, disability, medical).
-- Run FOURTH (after 01, 02, 03). Safe to re-run.
-- If you ever re-run 01 or 02, run 04, 05 and 06 again afterwards.
-- =====================================================================

-- ---------- Enum values ----------------------------------------------
-- New enum values are only compared as text below (never cast in this
-- script), so the file also works when the SQL editor runs it as one
-- transaction.
alter type public.civil_status_type    add value if not exists 'others';
alter type public.education_level_type add value if not exists 'doctorate' after 'postgraduate';
do $$ begin
  create type public.employment_sector_type as enum ('government', 'private', 'self_employed');
  exception when duplicate_object then null; end $$;

-- Civil status and employment are optional on the paper form, so
-- "not answered" is stored as null instead of a made-up default.
alter table public.youth                 alter column civil_status drop not null, alter column civil_status drop default;
alter table public.youth                 alter column employment_status drop not null, alter column employment_status drop default;
alter table public.pending_registrations alter column civil_status drop not null, alter column civil_status drop default;
alter table public.pending_registrations alter column employment_status drop not null, alter column employment_status drop default;

-- ---------- New columns (same set on youth and pending_registrations) --
do $$
declare t text;
begin
  foreach t in array array['youth', 'pending_registrations'] loop
    execute format($f$
      alter table public.%1$I
        add column if not exists email text check (email is null or char_length(email) <= 120),
        add column if not exists registered_voter boolean,
        add column if not exists civil_status_other text check (civil_status_other is null or char_length(civil_status_other) <= 60),
        add column if not exists course text check (course is null or char_length(course) <= 120),
        add column if not exists out_of_school_reason text check (out_of_school_reason is null or char_length(out_of_school_reason) <= 200),
        add column if not exists employment_sector public.employment_sector_type,
        add column if not exists employment_duration text check (employment_duration is null or char_length(employment_duration) <= 60),
        add column if not exists government_agency text check (government_agency is null or char_length(government_agency) <= 120),
        add column if not exists youth_org_member boolean,
        add column if not exists youth_org_name text check (youth_org_name is null or char_length(youth_org_name) <= 120),
        -- SENSITIVE personal information (Data Privacy Act, sec. 3(l))
        add column if not exists religion text check (religion is null or char_length(religion) <= 60),
        add column if not exists has_disability boolean,
        add column if not exists disability_details text check (disability_details is null or char_length(disability_details) <= 200),
        add column if not exists has_medical_condition boolean,
        add column if not exists medical_details text check (medical_details is null or char_length(medical_details) <= 200)
    $f$, t);
  end loop;
end $$;

-- ---------- Normalization + conditional fields (both tables) ---------
-- A conditional field is kept only while it applies, so the database
-- cleans it when the answer it depends on changes.
create or replace function public.clean_text(p text)
returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), '')
$$;

create or replace function public.clean_profile_extras()
returns trigger language plpgsql as $$
begin
  new.email := lower(public.clean_text(new.email));
  if new.email is not null and new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email address is not valid.' using errcode = 'check_violation';
  end if;

  new.civil_status_other := case when new.civil_status::text = 'others' then public.clean_text(new.civil_status_other) end;
  new.course := case when new.education_level::text in ('college', 'vocational', 'postgraduate', 'doctorate')
                     then public.clean_text(new.course) end;
  new.out_of_school_reason := case when new.education_status::text = 'out_of_school'
                                   then public.clean_text(new.out_of_school_reason) end;
  if new.employment_status::text is distinct from 'employed' then new.employment_sector := null; end if;
  new.employment_duration := case when new.employment_status::text in ('employed', 'self_employed')
                                  then public.clean_text(new.employment_duration) end;
  new.government_agency := case when new.employment_sector::text = 'government'
                                then public.clean_text(new.government_agency) end;

  new.youth_org_name := case when new.youth_org_member then public.clean_text(new.youth_org_name) end;
  if new.youth_org_member and new.youth_org_name is null then
    raise exception 'Name of the youth organization is required when the youth is a member.' using errcode = 'check_violation';
  end if;

  new.religion := public.clean_text(new.religion);
  new.disability_details := case when new.has_disability then public.clean_text(new.disability_details) end;
  new.medical_details := case when new.has_medical_condition then public.clean_text(new.medical_details) end;

  -- Sensitive information needs the consent version that explains it (ends in -SPI).
  if (new.religion is not null or new.has_disability is not null or new.has_medical_condition is not null)
     and new.consent_version not like '%-SPI'
     and (tg_op = 'INSERT' or (old.religion is null and old.has_disability is null and old.has_medical_condition is null)) then
    raise exception 'Religion, disability and medical information need the updated consent (version ending in -SPI).'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists youth_extras on public.youth;
create trigger youth_extras before insert or update on public.youth
  for each row execute function public.clean_profile_extras();
drop trigger if exists pending_extras on public.pending_registrations;
create trigger pending_extras before insert on public.pending_registrations
  for each row execute function public.clean_profile_extras();

-- ---------- Viewers never see sensitive columns ----------------------
-- private.grant_youth_select() (02_security.sql) grants SELECT on every
-- youth column except the sensitive ones. New columns need a re-grant.
select private.grant_youth_select();

-- Admin and Encoder read sensitive fields through this view. It runs with
-- the owner's rights (so it can read the hidden columns) and repeats the
-- row rules of the "youth read" policy itself.
create or replace view public.youth_sensitive with (security_barrier = true) as
select y.id, y.religion, y.has_disability, y.disability_details, y.has_medical_condition, y.medical_details
from public.youth y
where (select public.get_user_role()) in ('admin', 'encoder')
  and (y.deleted_at is null or (select public.get_user_role()) = 'admin');
revoke all on public.youth_sensitive from public, anon, authenticated;
grant select on public.youth_sensitive to authenticated;

-- Bulk read for exports: Admin only, and the read is logged (count only, no values).
create or replace function public.get_youth_sensitive_bulk(p_ids uuid[])
returns table (id uuid, religion text, has_disability boolean, disability_details text,
               has_medical_condition boolean, medical_details text)
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if (select public.get_user_role()) is distinct from 'admin' then
    raise exception 'Not allowed. Only an Admin can export sensitive information.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 5000 then raise exception 'Too many rows.'; end if;
  select full_name into v_name from public.profiles where profiles.id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, detail)
  values (auth.uid(), v_name, 'view', 'youth_sensitive', jsonb_build_object('rows', coalesce(array_length(p_ids, 1), 0), 'purpose', 'export'));
  return query
    select y.id, y.religion, y.has_disability, y.disability_details, y.has_medical_condition, y.medical_details
    from public.youth y where y.id = any(p_ids);
end $$;
revoke all on function public.get_youth_sensitive_bulk(uuid[]) from public, anon;
grant execute on function public.get_youth_sensitive_bulk(uuid[]) to authenticated;

-- ---------- youth_overview: add the non-sensitive new fields ---------
-- Same leading columns as 01_schema.sql; new ones are appended. No
-- religion, disability or medical columns here (Viewers read this view).
create or replace view public.youth_overview with (security_invoker = true) as
select
  y.id, y.youth_code, y.first_name, y.middle_name, y.last_name, y.suffix,
  concat_ws(' ', y.first_name, nullif(left(y.middle_name, 1) || '.', '.'), y.last_name, y.suffix) as full_name,
  y.birthdate,
  public.calc_age(y.birthdate) as age,
  public.age_bracket(public.calc_age(y.birthdate)) as age_bracket,
  y.sex, y.civil_status, y.purok_id, p.name as purok_name,
  y.education_status, y.education_level, y.employment_status,
  y.skills, y.interests, y.civic_involvement,
  (y.education_status = 'out_of_school') as is_osy,
  public.suggest_referrals(public.calc_age(y.birthdate), y.education_status, y.education_level, y.employment_status) as referrals,
  y.consent_version, y.consent_at, y.consent_source, y.guardian_name, y.guardian_relationship,
  y.guardian_consent_at, y.consent_scan_path,
  y.created_at, y.updated_at, y.deleted_at,
  y.email, y.registered_voter, y.civil_status_other, y.course, y.out_of_school_reason,
  y.employment_sector, y.employment_duration, y.government_agency, y.youth_org_member, y.youth_org_name
from public.youth y
join public.puroks p on p.id = y.purok_id;
grant select on public.youth_overview to authenticated;

-- ---------- Approval and import carry the new fields -----------------
create or replace function public.approve_registration(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.pending_registrations; v_id uuid; v_name text;
begin
  if (select public.get_user_role()) is null or (select public.get_user_role()) not in ('admin', 'encoder') then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.pending_registrations where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'This registration is no longer pending.'; end if;

  -- The registration was checked against the form settings when it was
  -- submitted; later settings changes must not block or alter it.
  perform set_config('kk.form_rules', 'off', true);
  begin
    insert into public.youth (first_name, middle_name, last_name, suffix, birthdate, sex, civil_status, purok_id,
      education_status, education_level, employment_status, skills, interests, civic_involvement,
      consent_version, consent_at, consent_source, guardian_name, guardian_relationship, guardian_consent_at,
      email, registered_voter, civil_status_other, course, out_of_school_reason, employment_sector, employment_duration,
      government_agency, youth_org_member, youth_org_name, religion, has_disability, disability_details,
      has_medical_condition, medical_details)
    values (r.first_name, r.middle_name, r.last_name, r.suffix, r.birthdate, r.sex, r.civil_status, r.purok_id,
      r.education_status, r.education_level, r.employment_status, r.skills, r.interests, r.civic_involvement,
      r.consent_version, r.consent_at, 'self_registration', r.guardian_name, r.guardian_relationship,
      case when r.guardian_name is not null then r.consent_at end,
      r.email, r.registered_voter, r.civil_status_other, r.course, r.out_of_school_reason, r.employment_sector, r.employment_duration,
      r.government_agency, r.youth_org_member, r.youth_org_name, r.religion, r.has_disability, r.disability_details,
      r.has_medical_condition, r.medical_details)
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

-- "yes"/"no"/"true"/"1" -> boolean, blank -> null, anything else -> error.
create or replace function public.parse_yes_no(p text)
returns boolean language plpgsql immutable as $$
declare v text := lower(btrim(coalesce(p, '')));
begin
  if v = '' then return null; end if;
  if v in ('yes', 'y', 'true', 't', '1', 'oo') then return true; end if;
  if v in ('no', 'n', 'false', 'f', '0', 'hindi') then return false; end if;
  raise exception 'Expected yes or no, got "%"', p;
end $$;

create or replace function public.import_youth(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb; v_i int := 0; v_results jsonb := '[]'; v_id uuid; v_purok uuid; v_name text;
  v_ok int := 0; v_fail int := 0; v_spi boolean;
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
      v_spi := nullif(btrim(coalesce(v_row ->> 'religion', '')), '') is not null
            or nullif(btrim(coalesce(v_row ->> 'has_disability', '')), '') is not null
            or nullif(btrim(coalesce(v_row ->> 'has_medical_condition', '')), '') is not null;

      insert into public.youth (first_name, middle_name, last_name, suffix, birthdate, sex, civil_status, purok_id,
        education_status, education_level, employment_status, skills, interests, civic_involvement,
        consent_version, consent_at, consent_source, guardian_name, guardian_relationship, guardian_consent_at,
        email, registered_voter, civil_status_other, course, out_of_school_reason, employment_sector, employment_duration,
        government_agency, youth_org_member, youth_org_name, religion, has_disability, disability_details,
        has_medical_condition, medical_details)
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
        public.parse_yes_no(v_row ->> 'has_medical_condition'), v_row ->> 'medical_details')
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

-- >>>>>>>>>>>>>>>>>>>> 05_form_settings.sql <<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>> 06_custom_questions.sql <<<<<<<<<<<<<<<<<<<<

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
-- row rules of the "youth read" policy: Admin and Encoder only. Viewers see answer counts
-- through summary_report() (08_viewer_aggregate_only.sql), never individual answers.
create or replace view public.youth_custom_answers with (security_barrier = true) as
select y.id,
       public.filter_custom_answers(y.custom_answers, false) as answers,
       case when (select public.get_user_role()) in ('admin', 'encoder')
            then public.filter_custom_answers(y.custom_answers, true) end as sensitive_answers
from public.youth y
where (select public.get_user_role()) in ('admin', 'encoder')
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

-- >>>>>>>>>>>>>>>>>>>> 07_user_management.sql <<<<<<<<<<<<<<<<<<<<

-- =====================================================================
-- KK Youth Profiling System  |  07_user_management.sql
-- Admin user management: archive / restore accounts, and an audit hook
-- for actions the server does with the service role (delete account,
-- reset password). Run SEVENTH (after 06_custom_questions.sql). Safe to re-run.
-- =====================================================================

-- An archived account is hidden from the active list and cannot sign in
-- (it is also deactivated). Restoring it reactivates it.
alter table public.profiles
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create or replace function public.guard_profile_archive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.full_name := btrim(regexp_replace(coalesce(new.full_name, ''), '\s+', ' ', 'g'));
  if char_length(new.full_name) > 120 then
    raise exception 'Name can have at most 120 characters.' using errcode = 'check_violation';
  end if;

  if new.archived_at is distinct from old.archived_at then
    if auth.uid() is not null then
      if public.get_user_role() is distinct from 'admin' then
        raise exception 'Only an Admin can archive or restore accounts.' using errcode = 'insufficient_privilege';
      end if;
      if new.id = auth.uid() then
        raise exception 'You cannot archive your own account.' using errcode = 'insufficient_privilege';
      end if;
    end if;
    if new.archived_at is not null then
      new.archived_at := now(); new.archived_by := auth.uid(); new.is_active := false;
    else
      new.archived_by := null; new.is_active := true;
    end if;
  else
    new.archived_by := old.archived_by;
    if new.archived_at is not null and new.is_active then
      raise exception 'Restore the account from the archive first.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

-- Sorts before profiles_guard (02), which then checks the is_active change.
drop trigger if exists profiles_archive_guard on public.profiles;
create trigger profiles_archive_guard before update on public.profiles
  for each row execute function public.guard_profile_archive();

-- 02_security.sql grants update on (full_name, role, is_active); add archived_at.
grant update (full_name, role, is_active, archived_at) on public.profiles to authenticated;

-- Deleting an account and resetting a password need the service role (server only).
-- Before doing either, the server calls this with the Admin's own session: it checks that
-- the caller is an Admin, refuses the Admin's own account, and writes the audit entry.
create or replace function public.log_user_admin_action(p_user uuid, p_action text)
returns text language plpgsql security definer set search_path = public as $$
declare v_target text; v_name text;
begin
  if (select public.get_user_role()) is distinct from 'admin' then
    raise exception 'Not allowed.' using errcode = 'insufficient_privilege';
  end if;
  if p_action not in ('delete', 'password_reset') then raise exception 'Unsupported action.'; end if;
  if p_user = auth.uid() then
    raise exception 'You cannot do this to your own account here. Use My account instead.' using errcode = 'insufficient_privilege';
  end if;
  select full_name into v_target from public.profiles where id = p_user;
  if not found then raise exception 'User not found.'; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, table_name, record_id, detail)
  values (auth.uid(), v_name, case when p_action = 'delete' then 'delete' else 'update' end, 'profiles', p_user::text,
          jsonb_build_object('user', v_target, 'event', p_action));
  return v_target;
end $$;
revoke all on function public.log_user_admin_action(uuid, text) from public, anon;
grant execute on function public.log_user_admin_action(uuid, text) to authenticated;

-- >>>>>>>>>>>>>>>>>>>> 08_viewer_aggregate_only.sql <<<<<<<<<<<<<<<<<<<<

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
