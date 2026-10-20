-- =====================================================================
-- KK Youth Profiling System  |  03_seed.sql   (optional, run THIRD)
-- Sample puroks. Replace with your barangay's real puroks/sitios
-- from the app (Puroks page) after you sign in as Admin.
-- =====================================================================
insert into public.puroks (name, description)
select v.name, v.description
from (values
  ('Purok 1', 'Sample purok'),
  ('Purok 2', 'Sample purok'),
  ('Purok 3', 'Sample purok'),
  ('Purok 4', 'Sample purok')
) as v(name, description)
where not exists (
  select 1 from public.puroks p where lower(btrim(p.name)) = lower(v.name) and p.deleted_at is null);
