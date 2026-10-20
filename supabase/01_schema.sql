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

create or replace view public.activity_stats with (security_invoker = true) as
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
where a.deleted_at is null;

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

-- Aggregates are computed in SQL, not in the browser.
create or replace function public.dashboard_summary()
returns jsonb language sql stable as $$
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
  )
$$;
