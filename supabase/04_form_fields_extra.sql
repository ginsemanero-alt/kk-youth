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
