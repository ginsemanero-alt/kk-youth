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
-- added by 04_form_fields_extra.sql) is never written to the log: the log
-- only says that such a field was set or changed.
create or replace function public.audit_mask(p_data jsonb, p_marker text)
returns jsonb language plpgsql immutable as $$
declare k text;
begin
  if p_data is null then return null; end if;
  foreach k in array array['religion', 'has_disability', 'disability_details', 'has_medical_condition', 'medical_details'] loop
    if p_data ? k and p_data -> k <> 'null'::jsonb then
      p_data := jsonb_set(p_data, array[k], to_jsonb(p_marker));
    end if;
  end loop;
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
create policy "youth read" on public.youth for select to authenticated
  using ((select public.get_user_role()) is not null and (deleted_at is null or (select public.get_user_role()) = 'admin'));
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
create policy "attendance read" on public.attendance for select to authenticated
  using ((select public.get_user_role()) is not null);
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
