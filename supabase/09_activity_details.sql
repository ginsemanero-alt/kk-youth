-- =====================================================================
-- KK Youth Profiling System  |  09_activity_details.sql
-- Detailed SK activities (time, status, organizer, objectives, target,
-- budget, partners, outcome) and activity photos in a private bucket.
-- Photos of youth are personal data: Admin and Encoder only, never public,
-- never shown to Viewers. Run NINTH (after 08). Safe to re-run.
-- =====================================================================

-- ---------- Activity details -----------------------------------------
alter table public.activities
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists status text not null default 'planned'
    check (status in ('planned', 'ongoing', 'completed', 'cancelled')),
  add column if not exists organizer text check (organizer is null or char_length(organizer) <= 120),
  add column if not exists objectives text check (objectives is null or char_length(objectives) <= 1000),
  add column if not exists target_participants int check (target_participants is null or target_participants between 1 and 100000),
  add column if not exists budget numeric(12, 2) check (budget is null or budget >= 0),
  add column if not exists fund_source text check (fund_source is null or char_length(fund_source) <= 120),
  add column if not exists partners text check (partners is null or char_length(partners) <= 300),
  add column if not exists outcome text check (outcome is null or char_length(outcome) <= 2000),
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.activities add constraint activities_time_order check (start_time is null or end_time is null or end_time > start_time);
  exception when duplicate_object then null; end $$;

create or replace function public.clean_activity()
returns trigger language plpgsql as $$
begin
  new.title := btrim(regexp_replace(new.title, '\s+', ' ', 'g'));
  new.venue := public.clean_text(new.venue);
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.organizer := public.clean_text(new.organizer);
  new.objectives := nullif(btrim(coalesce(new.objectives, '')), '');
  new.fund_source := public.clean_text(new.fund_source);
  new.partners := public.clean_text(new.partners);
  new.outcome := nullif(btrim(coalesce(new.outcome, '')), '');
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end $$;
drop trigger if exists activities_clean on public.activities;
create trigger activities_clean before insert or update on public.activities
  for each row execute function public.clean_activity();

-- ---------- Photos ----------------------------------------------------
create table if not exists public.activity_photos (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  path        text not null unique check (char_length(path) <= 300),
  caption     text check (caption is null or char_length(caption) <= 200),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists activity_photos_activity_idx on public.activity_photos (activity_id, created_at);

-- The uploader is stamped by the database; the file must sit in the activity's folder; at most 40 per activity.
create or replace function public.prepare_activity_photo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.caption := public.clean_text(new.caption);
  if tg_op = 'INSERT' then
    new.uploaded_by := auth.uid();
    new.created_at := now();
    if split_part(new.path, '/', 1) <> new.activity_id::text then
      raise exception 'Photo path must start with the activity id.' using errcode = 'check_violation';
    end if;
    if (select count(*) from public.activity_photos where activity_id = new.activity_id) >= 40 then
      raise exception 'An activity can have at most 40 photos.' using errcode = 'check_violation';
    end if;
  else
    new.activity_id := old.activity_id; new.path := old.path; new.uploaded_by := old.uploaded_by; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists activity_photos_prepare on public.activity_photos;
create trigger activity_photos_prepare before insert or update on public.activity_photos
  for each row execute function public.prepare_activity_photo();

drop trigger if exists audit_activity_photos on public.activity_photos;
create trigger audit_activity_photos after insert or update or delete on public.activity_photos
  for each row execute function public.audit_row();

revoke all on public.activity_photos from anon, authenticated;
grant select, insert, delete on public.activity_photos to authenticated;
grant update (caption) on public.activity_photos to authenticated;
alter table public.activity_photos enable row level security;

drop policy if exists "activity photos staff read" on public.activity_photos;
create policy "activity photos staff read" on public.activity_photos for select to authenticated
  using ((select public.get_user_role()) in ('admin', 'encoder'));
drop policy if exists "activity photos staff insert" on public.activity_photos;
create policy "activity photos staff insert" on public.activity_photos for insert to authenticated
  with check ((select public.get_user_role()) in ('admin', 'encoder'));
drop policy if exists "activity photos staff caption" on public.activity_photos;
create policy "activity photos staff caption" on public.activity_photos for update to authenticated
  using ((select public.get_user_role()) in ('admin', 'encoder')) with check ((select public.get_user_role()) in ('admin', 'encoder'));
-- An Encoder removes only their own photos; an Admin removes any.
drop policy if exists "activity photos delete own or admin" on public.activity_photos;
create policy "activity photos delete own or admin" on public.activity_photos for delete to authenticated
  using ((select public.get_user_role()) = 'admin'
         or ((select public.get_user_role()) = 'encoder' and uploaded_by = auth.uid()));

-- ---------- Private storage bucket ------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-photos', 'activity-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "activity photos files staff read" on storage.objects;
create policy "activity photos files staff read" on storage.objects for select to authenticated
  using (bucket_id = 'activity-photos' and (select public.get_user_role()) in ('admin', 'encoder'));
-- Files go into a folder named after an existing activity.
drop policy if exists "activity photos files staff upload" on storage.objects;
create policy "activity photos files staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'activity-photos' and (select public.get_user_role()) in ('admin', 'encoder')
              and exists (select 1 from public.activities a where a.id::text = split_part(storage.objects.name, '/', 1) and a.deleted_at is null));
-- Same rule as the photo rows: Admin any, Encoder only files whose photo row they uploaded.
drop policy if exists "activity photos files delete" on storage.objects;
create policy "activity photos files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'activity-photos'
         and ((select public.get_user_role()) = 'admin'
              or ((select public.get_user_role()) = 'encoder'
                  and exists (select 1 from public.activity_photos p where p.path = storage.objects.name and p.uploaded_by = auth.uid()))));

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
