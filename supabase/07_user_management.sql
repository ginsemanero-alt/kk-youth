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
