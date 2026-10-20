import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../', import.meta.url))
const s1 = fs.readFileSync(dir + '01_schema.sql', 'utf8')
const s2 = fs.readFileSync(dir + '02_security.sql', 'utf8')
const s3 = fs.readFileSync(dir + '03_seed.sql', 'utf8')
const s4 = fs.readFileSync(dir + '04_form_fields_extra.sql', 'utf8')
const s5 = fs.readFileSync(dir + '05_form_settings.sql', 'utf8')

const db = new PGlite({ extensions: { pgcrypto } })
const stubs = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema extensions;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, description text, secret text);
create function vault.create_secret(s text, n text, d text default '') returns uuid language sql as
  $$ insert into vault.secrets(secret, name, description) values (s, n, d) returning id $$;
create view vault.decrypted_secrets as select id, name, description, secret as decrypted_secret from vault.secrets;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
`
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name) } else { fail++; console.log('  FAIL', name, extra) } }
const q = async (sql) => (await db.query(sql)).rows
const asUser = async (id, sql, role = 'authenticated') => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${id ?? ''}', false);`)
  try { return await db.query(sql) } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`) }
}
const err = async (id, sql, role) => { try { await asUser(id, sql, role); return null } catch (e) { return String(e.message) } }
const anon = (sql) => asUser(null, sql, 'anon')
const anonErr = (sql) => err(null, sql, 'anon')

try {
  await db.exec(`create extension pgcrypto with schema extensions;`).catch(() => {})
  await db.exec(stubs)
  await db.exec(`create extension if not exists pgcrypto with schema extensions;`).catch(async () => {})
  await db.exec(`grant usage on schema public, extensions to anon, authenticated;`)
  await db.exec(s1); console.log('01 applied')
  await db.exec(s2); console.log('02 applied')
  await db.exec(s3); await db.exec(s4); console.log('04 applied')
  await db.exec(s5); console.log('05 applied')
  for (const f of [s1, s2, s3, s4, s5]) await db.exec(f)
  console.log('re-applied 01 to 05 in order (idempotent)')
  ok('seed puroks, idempotent', (await q('select count(*)::int c from puroks'))[0].c === 4)

  const id = { admin: '00000000-0000-0000-0000-0000000000a1', enc: '00000000-0000-0000-0000-0000000000e1', view: '00000000-0000-0000-0000-0000000000f1', enc2: '00000000-0000-0000-0000-0000000000e2' }
  for (const [k, v] of Object.entries(id)) await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${v}','${k}@x.com','{"full_name":"User ${k}","role":"admin"}')`)
  ok('profiles auto-created as viewer (metadata role ignored)', (await q(`select count(*)::int c from profiles where role='viewer'`))[0].c === 4)
  await db.exec(`update profiles set role='admin' where id='${id.admin}'; update profiles set role='encoder' where id in ('${id.enc}','${id.enc2}')`)
  ok('SQL editor can promote roles', (await q(`select role from profiles where id='${id.admin}'`))[0].role === 'admin')

  // ----- profiles / roles
  let r = await asUser(id.view, `update profiles set role='admin' where id='${id.view}' returning id`)
  ok('viewer cannot self-promote (0 rows)', r.rows.length === 0)
  let e = await err(id.admin, `update profiles set role='viewer' where id='${id.admin}'`)
  ok('admin cannot demote self', e && e.includes('cannot change your own'), e)
  r = await asUser(id.admin, `update profiles set role='viewer', is_active=true where id='${id.enc2}' returning role`)
  ok('admin can change another role', r.rows[0]?.role === 'viewer')
  await db.exec(`update profiles set role='encoder' where id='${id.enc2}'`)
  ok('encoder cannot list other profiles', (await asUser(id.enc, `select * from profiles`)).rows.length === 1)
  ok('admin lists all profiles', (await asUser(id.admin, `select * from profiles`)).rows.length === 4)

  // ----- youth
  const purok = (await q(`select id from puroks order by name limit 1`))[0].id
  const purok2 = (await q(`select id from puroks order by name offset 1 limit 1`))[0].id
  const mk = (o = {}) => {
    const v = { first_name: 'Maria', middle_name: 'Santos', last_name: 'Cruz', birthdate: '2002-05-10', sex: 'female', education_status: 'out_of_school',
      education_level: 'senior_high', employment_status: 'unemployed', skills: "ARRAY['Cooking',' cooking ','Web design']", interests: "ARRAY['Basketball']", guardian: '', ...o }
    const g = v.guardian ? `, guardian_name, guardian_consent_at` : ''
    const gv = v.guardian ? `, '${v.guardian}', now()` : ''
    return `insert into youth (first_name, middle_name, last_name, birthdate, sex, purok_id, education_status, education_level, employment_status, skills, interests, consent_version, consent_at${g})
            values ('${v.first_name}', '${v.middle_name}', '${v.last_name}', '${v.birthdate}', '${v.sex}', '${v.purok ?? purok}', '${v.education_status}', '${v.education_level}', '${v.employment_status}', ${v.skills}, ${v.interests}, 'KK-CONSENT-v1.0', now()${gv}) returning id, youth_code, skills`
  }
  r = await asUser(id.enc, mk())
  const y1 = r.rows[0]
  ok('encoder can insert youth, code generated', /^KK-\d{4}-\d{5}$/.test(y1.youth_code), y1.youth_code)
  ok('skills normalized + deduped', JSON.stringify(y1.skills) === JSON.stringify(['cooking', 'web design']), JSON.stringify(y1.skills))
  ok('created_by stamped', (await q(`select created_by from youth where id='${y1.id}'`))[0].created_by === id.enc)
  e = await err(id.view, mk({ first_name: 'Pedro', last_name: 'Reyes' }))
  ok('viewer cannot insert youth', e && /row-level security/.test(e), e)
  e = await anonErr(`select * from youth`)
  ok('anon cannot read youth', e && /permission denied/.test(e), e)
  e = await anonErr(`select * from youth_overview`)
  ok('anon cannot read overview', e && /permission denied/.test(e), e)
  e = await err(id.enc, mk({ birthdate: '2020-01-01' }))
  ok('rejects age below 15', e && e.includes('between 15 and 30'), e)
  e = await err(id.enc, mk({ first_name: 'Old', birthdate: '1980-01-01' }))
  ok('rejects age above 30', e && e.includes('between 15 and 30'), e)
  const minorBirth = new Date(); minorBirth.setFullYear(minorBirth.getFullYear() - 16); const mb = minorBirth.toISOString().slice(0, 10)
  e = await err(id.enc, mk({ first_name: 'Minor', birthdate: mb }))
  ok('minor without guardian rejected', e && e.includes('guardian consent'), e)
  r = await asUser(id.enc, mk({ first_name: 'Minor', birthdate: mb, guardian: 'Ana Minor' }))
  ok('minor with guardian accepted', r.rows.length === 1)
  e = await err(id.enc, mk({ first_name: '  maria ', middle_name: 'SANTOS', last_name: 'CRUZ' }))
  ok('duplicate name+birthdate blocked (case/space-insensitive)', e && e.includes('youth_no_duplicates'), e)
  r = await asUser(id.enc, mk({ first_name: 'Maria', birthdate: '2002-05-11' }))
  ok('same name, different birthdate allowed', r.rows.length === 1)

  // ----- contact encryption
  await asUser(id.enc, `select set_youth_contact('${y1.id}', '09171234567')`)
  const raw = (await q(`select encode(contact_enc, 'escape') as t from youth_contacts where youth_id='${y1.id}'`))[0].t
  ok('contact stored encrypted (not plaintext)', !raw.includes('09171234567'))
  ok('encoder can decrypt contact', (await asUser(id.enc, `select get_youth_contact('${y1.id}') c`)).rows[0].c === '09171234567')
  e = await err(id.view, `select get_youth_contact('${y1.id}')`)
  ok('viewer cannot read contact', e && e.includes('Not allowed'), e)
  e = await err(id.enc, `select * from youth_contacts`)
  ok('no direct table access to contacts', e && /permission denied/.test(e), e)
  ok('contact view is audited', (await q(`select count(*)::int c from audit_logs where action='view' and table_name='youth_contacts'`))[0].c === 1)
  e = await err(id.view, `select set_youth_contact('${y1.id}', '0999')`)
  ok('viewer cannot set contact', e && e.includes('Not allowed'), e)

  // ----- soft delete
  e = await err(id.enc, `update youth set deleted_at = now() where id='${y1.id}'`)
  ok('encoder cannot delete youth', e && e.includes('Only an Admin'), e)
  e = await err(id.admin, `delete from youth where id='${y1.id}'`)
  ok('hard delete denied via API', e && /permission denied/.test(e), e)
  const y2 = (await q(`select id from youth where first_name='Maria' and birthdate='2002-05-11'`))[0]
  await asUser(id.admin, `update youth set deleted_at = now() where id='${y2.id}'`)
  ok('soft-deleted hidden from encoder', (await asUser(id.enc, `select id from youth where id='${y2.id}'`)).rows.length === 0)
  ok('soft-deleted visible to admin', (await asUser(id.admin, `select id from youth where id='${y2.id}'`)).rows.length === 1)
  await asUser(id.admin, `update youth set deleted_at = null where id='${y2.id}'`)
  ok('admin can restore', (await asUser(id.enc, `select id from youth where id='${y2.id}'`)).rows.length === 1)

  // ----- audit
  await asUser(id.enc, `update youth set civil_status='married' where id='${y1.id}'`)
  const au = await q(`select action, new_data, old_data from audit_logs where table_name='youth' and record_id='${y1.id}' order by id`)
  ok('audit: insert logged', au[0]?.action === 'insert')
  ok('audit: update logs only changed fields', au.some((a) => a.action === 'update' && a.new_data.civil_status === 'married' && !('first_name' in a.new_data)))
  ok('audit: delete/restore logged', (await q(`select count(*)::int c from audit_logs where action in ('delete','restore')`))[0].c === 2)
  ok('audit contains no phone number', (await q(`select count(*)::int c from audit_logs where (new_data::text || coalesce(detail::text,'')) like '%0917%'`))[0].c === 0)
  e = await err(id.enc, `select * from audit_logs`)
  ok('encoder cannot read audit logs', e && /permission denied/.test(e) || (await asUser(id.enc, `select * from audit_logs`)).rows.length === 0, e)
  ok('admin can read audit logs', (await asUser(id.admin, `select * from audit_logs`)).rows.length > 3)
  e = await err(id.admin, `delete from audit_logs`)
  ok('audit log cannot be deleted', e && /permission denied/.test(e), e)
  e = await err(null, `update audit_logs set action='view'`, 'postgres').catch(() => 'x')
  try { await db.exec(`update audit_logs set action='view'`); ok('audit append-only trigger', false) } catch (x) { ok('audit append-only trigger (even superuser)', String(x.message).includes('append-only')) }

  // ----- self registration
  const reg = (o = {}) => {
    const v = { first: 'Lito', last: 'Ramos', birth: '2001-03-03', guardian: 'null', status: "'pending'", contact: "'09189998888'", ...o }
    return `insert into pending_registrations (first_name, last_name, birthdate, sex, purok_id, education_status, employment_status, skills, consent_version, contact_number, guardian_name, status)
            values ('${v.first}', '${v.last}', '${v.birth}', 'male', '${purok}', 'in_school', 'unemployed', ARRAY['drawing'], 'KK-CONSENT-v1.0', ${v.contact}, ${v.guardian}, ${v.status})`
  }
  await anon(reg())
  const p1 = (await q(`select * from pending_registrations where first_name='Lito'`))[0]
  ok('anon can submit registration', !!p1)
  ok('plaintext contact never stored', p1.contact_number === null && p1.contact_enc !== null)
  e = await anonErr(`select * from pending_registrations`)
  ok('anon cannot read registrations', e && /permission denied/.test(e), e)
  e = await anonErr(`update pending_registrations set status='approved'`)
  ok('anon cannot update registrations', e && /permission denied/.test(e), e)
  await anon(reg({ first: 'Sneaky', status: "'approved'" }))
  ok('forged status is forced to pending', (await q(`select status from pending_registrations where first_name='Sneaky'`))[0].status === 'pending')
  e = await anonErr(reg({ first: 'Kid', birth: '2020-01-01' }))
  ok('registration rejects age < 15', e && e.includes('15 to 30'), e)
  e = await anonErr(reg({ first: 'Teen', birth: mb }))
  ok('minor registration needs guardian', e && e.includes('guardian'), e)
  ok('anon can read active puroks only', (await anon(`select * from puroks`)).rows.length === 4)

  // ----- approval
  e = await err(id.view, `select approve_registration('${p1.id}')`)
  ok('viewer cannot approve', e && e.includes('Not allowed'), e)
  const newId = (await asUser(id.enc, `select approve_registration('${p1.id}') as id`)).rows[0].id
  ok('encoder approval creates youth', !!newId)
  ok('approved youth marked self_registration with consent', (await q(`select consent_source, consent_version from youth where id='${newId}'`))[0].consent_source === 'self_registration')
  ok('contact moved to encrypted store', (await asUser(id.enc, `select get_youth_contact('${newId}') c`)).rows[0].c === '09189998888')
  ok('pending ciphertext cleared after approval', (await q(`select contact_enc from pending_registrations where id='${p1.id}'`))[0].contact_enc === null)
  e = await err(id.enc, `select approve_registration('${p1.id}')`)
  ok('cannot approve twice', e && e.includes('no longer pending'), e)
  await anon(reg({ first: 'Lito' }))
  const p2 = (await q(`select id from pending_registrations where first_name='Lito' and status='pending'`))[0]
  e = await err(id.enc, `select approve_registration('${p2.id}')`)
  ok('duplicate on approval gives friendly error', e && e.includes('Duplicate'), e)
  await asUser(id.enc, `select reject_registration('${p2.id}', 'duplicate entry')`)
  ok('reject works and is logged', (await q(`select count(*)::int c from audit_logs where action='reject'`))[0].c === 1)

  // ----- import
  const rows = JSON.stringify([
    { first_name: 'Ana', last_name: 'Lopez', birthdate: '2000-01-01', sex: 'female', purok: 'purok 2', education_status: 'graduated', education_level: 'college', employment_status: 'employed', skills: ['welding'], contact_number: '0917000111' },
    { first_name: 'Ana', last_name: 'Lopez', birthdate: '2000-01-01', sex: 'female', purok: 'Purok 2', education_status: 'graduated' },
    { first_name: 'Bad', last_name: 'Purok', birthdate: '2000-01-01', sex: 'male', purok: 'Nowhere', education_status: 'graduated' },
    { first_name: 'Bad', last_name: 'Enum', birthdate: '2000-01-01', sex: 'alien', purok: 'Purok 1', education_status: 'graduated' },
    { first_name: 'Kid', last_name: 'NoGuardian', birthdate: mb, sex: 'male', purok: 'Purok 1', education_status: 'in_school' },
    { first_name: 'Kid', last_name: 'WithGuardian', birthdate: mb, sex: 'male', purok: 'Purok 1', education_status: 'in_school', guardian_name: 'Mom' },
  ]).replace(/'/g, "''")
  const imp = (await asUser(id.enc, `select import_youth('${rows}'::jsonb) as r`)).rows[0].r
  ok('import: 2 imported, 4 failed with reasons', imp.imported === 2 && imp.failed === 4, JSON.stringify(imp))
  ok('import: duplicate message', imp.results[1].error.includes('Duplicate'))
  ok('import: unknown purok message', imp.results[2].error.includes('Unknown purok'))
  e = await err(id.view, `select import_youth('[]'::jsonb)`)
  ok('viewer cannot import', e && e.includes('Not allowed'), e)

  // ----- dashboard / activities
  const dash = (await asUser(id.view, `select dashboard_summary() d`)).rows[0].d
  ok('viewer can read dashboard summary', dash.total >= 5 && dash.age_brackets.length === 3 && dash.puroks.length === 4, JSON.stringify(dash).slice(0, 200))
  ok('dashboard osy count matches', dash.osy === (await q(`select count(*)::int c from youth where education_status='out_of_school' and deleted_at is null`))[0].c)
  const act = (await asUser(id.enc, `insert into activities (title, category, activity_date) values ('Clean-up Drive','environment', current_date) returning id`)).rows[0]
  await asUser(id.enc, `insert into attendance (activity_id, youth_id) values ('${act.id}', '${y1.id}')`)
  e = await err(id.enc, `insert into attendance (activity_id, youth_id) values ('${act.id}', '${y1.id}')`)
  ok('duplicate attendance blocked', e && e.includes('attendance_activity_id_youth_id_key'), e)
  e = await err(id.view, `insert into attendance (activity_id, youth_id) values ('${act.id}', '${y2.id}')`)
  ok('viewer cannot record attendance', e && /row-level security/.test(e), e)
  const st = (await asUser(id.view, `select * from activity_stats`)).rows[0]
  ok('participation rate computed in SQL', st.attendees === 1 && Number(st.participation_rate) > 0, JSON.stringify(st))
  const un = (await asUser(id.view, `select * from unreached_youth(null)`)).rows
  ok('unreached list excludes attendee', un.length === dash.total - 1 && !un.some((u) => u.id === y1.id))
  const ref = (await asUser(id.view, `select referrals, is_osy from youth_overview where id='${y1.id}'`)).rows[0]
  ok('OSY gets referral suggestions', ref.is_osy && ref.referrals.length >= 2, JSON.stringify(ref))

  // ----- purok guard + purge + storage
  e = await err(id.admin, `update puroks set deleted_at=now() where id='${purok}'`)
  ok('purok with youth cannot be deleted', e && e.includes('still has youth'), e)
  e = await err(id.enc, `insert into puroks (name) values ('Purok 9')`)
  ok('encoder cannot create purok', e && /row-level security/.test(e), e)
  await db.exec(`update youth set deleted_at = now() - interval '400 days' where id='${y2.id}'`)
  e = await err(id.enc, `select purge_soft_deleted(365)`)
  ok('encoder cannot purge', e && e.includes('Only an Admin'), e)
  ok('admin purge removes old soft-deleted only', (await asUser(id.admin, `select purge_soft_deleted(365) n`)).rows[0].n === 1)
  const bucket = (await q(`select public, file_size_limit from storage.buckets where id='consent-scans'`))[0]
  ok('consent bucket is private with size limit', bucket.public === false && Number(bucket.file_size_limit) === 5242880)
  await db.exec(`grant usage on schema storage to authenticated; grant select, insert on storage.objects to authenticated`)
  e = await err(id.view, `insert into storage.objects (bucket_id, name) values ('consent-scans','x/y.pdf')`)
  ok('viewer cannot upload consent scan', e && /row-level security/.test(e), e)
  ok('encoder can upload consent scan', (await asUser(id.enc, `insert into storage.objects (bucket_id, name) values ('consent-scans','x/y.pdf') returning name`)).rows.length === 1)
  ok('viewer cannot list consent scans', (await asUser(id.view, `select * from storage.objects`)).rows.length === 0)

  // ===== Phase 0 + A: paper-form fields and form settings =====
  const ins = (cols) => {
    const base = { first_name: 'Form', last_name: 'Test', birthdate: '2001-02-02', sex: 'male', purok_id: purok, education_status: 'in_school', consent_version: 'KK-CONSENT-v1.1', ...cols }
    const keys = Object.keys(base)
    const val = (v) => v === null ? 'null' : typeof v === 'boolean' ? String(v) : Array.isArray(v) ? `ARRAY[${v.map((x) => `'${x}'`).join(',')}]::text[]` : `'${String(v).replace(/'/g, "''")}'`
    return { youth: `insert into youth (${keys.join(', ')}, consent_at) values (${keys.map((k) => val(base[k])).join(', ')}, now()) returning id`,
             pending: `insert into pending_registrations (${keys.join(', ')}) values (${keys.map((k) => val(base[k])).join(', ')})` }
  }
  const setField = (who, key, vis, req) => asUser(who, `update form_fields set is_visible=${vis}, is_required=${req} where field_key='${key}' returning is_visible, is_required`)

  // (a) only Admin can change form settings
  ok('form settings seeded with sensitive fields hidden', (await q(`select count(*)::int c from form_fields where is_sensitive and not is_visible`))[0].c === 3)
  ok('core fields are not in form settings', (await q(`select count(*)::int c from form_fields where field_key in ('first_name','last_name','birthdate','sex','purok_id','education_status')`))[0].c === 0)
  ok('anon can read form settings', (await anon(`select * from form_fields`)).rows.length === 20)
  ok('viewer can read form settings', (await asUser(id.view, `select * from form_fields`)).rows.length === 20)
  ok('viewer cannot update form settings (0 rows)', (await setField(id.view, 'email', true, true)).rows.length === 0)
  ok('encoder cannot update form settings (0 rows)', (await setField(id.enc, 'email', true, true)).rows.length === 0)
  e = await anonErr(`update form_fields set is_required = true`)
  ok('anon cannot update form settings', e && /permission denied/.test(e), e)
  e = await err(id.admin, `insert into form_fields (field_key, label, section) values ('x','X','other')`)
  ok('admin cannot insert form fields from the client', e && /permission denied/.test(e), e)
  e = await err(id.admin, `delete from form_fields where field_key='email'`)
  ok('admin cannot delete form fields from the client', e && /permission denied/.test(e), e)
  e = await err(id.admin, `update form_fields set label='Hacked' where field_key='email'`)
  ok('admin cannot rename a field (column grant)', e && /permission denied/.test(e), e)
  ok('admin can make a field required', (await setField(id.admin, 'email', true, true)).rows[0]?.is_required === true)
  r = await setField(id.admin, 'suffix', false, true)
  ok('hidden field is never required', r.rows[0]?.is_visible === false && r.rows[0]?.is_required === false)
  await setField(id.admin, 'suffix', true, false)
  e = await err(id.admin, `update form_fields set is_visible=false where field_key='employment_status'`)
  ok('cannot hide a field while a dependent field is visible', e && e.includes('Hide "Employment sector" first'), e)
  e = await err(id.admin, `update form_fields set is_visible=false where field_key='education_level'`)
  ok('cannot hide education level while course is visible', e && e.includes('Course'), e)
  ok('form settings changes are audited', (await q(`select count(*)::int c from audit_logs where table_name='form_fields' and record_id='email' and action='update'`))[0].c >= 1)

  const snap = async () => (await q(`select md5(string_agg(to_jsonb(y)::text, '|' order by id)) h from youth y`))[0].h

  // (b) required fields are enforced by the database
  e = await anonErr(ins({ first_name: 'NoEmail' }).pending)
  ok('registration missing a required field is rejected', e && e.includes('Required field: Email address'), e)
  await anon(ins({ first_name: 'HasEmail', email: ' Juan@Example.COM ' }).pending)
  ok('registration with the required field is accepted, email normalized', (await q(`select email from pending_registrations where first_name='HasEmail'`))[0].email === 'juan@example.com')
  e = await err(id.enc, ins({ first_name: 'NoEmail2' }).youth)
  ok('encoder insert missing a required field is rejected', e && e.includes('Required field: Email address'), e)
  e = await err(id.enc, ins({ first_name: 'BadEmail', email: 'not-an-email' }).youth)
  ok('invalid email rejected by the database', e && e.includes('Email address is not valid'), e)
  const impReq = (await asUser(id.enc, `select import_youth('${JSON.stringify([{ first_name: 'Imp', last_name: 'NoMail', birthdate: '2000-01-01', sex: 'male', purok: 'Purok 1', education_status: 'graduated' }])}'::jsonb) as r`)).rows[0].r
  ok('import row missing a required field fails with a reason', impReq.failed === 1 && impReq.results[0].error.includes('Email address'), JSON.stringify(impReq))
  await setField(id.admin, 'employment_sector', true, true)
  r = await asUser(id.enc, ins({ first_name: 'Jobless', email: 'a@b.co', employment_status: 'unemployed' }).youth)
  ok('required conditional field is not needed when it does not apply', r.rows.length === 1)
  e = await err(id.enc, ins({ first_name: 'NoSector', email: 'a@b.co', employment_status: 'employed' }).youth)
  ok('required conditional field is needed when it applies', e && e.includes('Employment sector'), e)
  e = await err(id.enc, `update youth set email = '' where id='${r.rows[0].id}'`)
  ok('an edit cannot blank a required field', e && e.includes('Required field'), e)
  await setField(id.admin, 'employment_sector', true, false)
  await setField(id.admin, 'email', true, false)

  // (c) conditional fields are cleaned by the database
  r = await asUser(id.enc, ins({ first_name: 'Cond', education_status: 'in_school', out_of_school_reason: 'financial', education_level: 'senior_high', course: 'BSIT',
    employment_status: 'unemployed', employment_sector: 'government', government_agency: 'DepEd', employment_duration: '2 years',
    civil_status: 'single', civil_status_other: 'x', youth_org_member: false, youth_org_name: 'Red Cross Youth' }).youth)
  const cond = (await q(`select out_of_school_reason, course, employment_sector, government_agency, employment_duration, civil_status_other, youth_org_name from youth where id='${r.rows[0].id}'`))[0]
  ok('non-applicable conditional fields are cleared', Object.values(cond).every((v) => v === null), JSON.stringify(cond))
  r = await asUser(id.enc, ins({ first_name: 'Osy', education_status: 'out_of_school', out_of_school_reason: ' financial  problem ', education_level: 'college', course: 'BSIT',
    employment_status: 'employed', employment_sector: 'government', government_agency: 'DepEd', employment_duration: '2 years', civil_status: 'others', civil_status_other: 'Annulled' }).youth)
  const osyId = r.rows[0].id
  const kept = (await q(`select out_of_school_reason, course, government_agency, civil_status_other from youth where id='${osyId}'`))[0]
  ok('applicable conditional fields are kept (and trimmed)', kept.out_of_school_reason === 'financial problem' && kept.course === 'BSIT' && kept.government_agency === 'DepEd' && kept.civil_status_other === 'Annulled', JSON.stringify(kept))
  await asUser(id.enc, `update youth set education_status='in_school', employment_sector='private' where id='${osyId}'`)
  const after1 = (await q(`select out_of_school_reason, government_agency from youth where id='${osyId}'`))[0]
  ok('changing the answer clears the dependent field on edit', after1.out_of_school_reason === null && after1.government_agency === null, JSON.stringify(after1))
  e = await err(id.enc, ins({ first_name: 'OrgNoName', youth_org_member: true }).youth)
  ok('youth organization name is required when member', e && e.includes('Name of the youth organization'), e)

  // hidden fields: new records get no value
  await anon(ins({ first_name: 'HiddenRel', religion: 'Catholic', has_disability: true, disability_details: 'x' }).pending)
  const hid = (await q(`select religion, has_disability, disability_details from pending_registrations where first_name='HiddenRel'`))[0]
  ok('values for hidden fields are dropped on submit', hid.religion === null && hid.has_disability === null && hid.disability_details === null, JSON.stringify(hid))

  // (d) sensitive fields: Admin and Encoder only
  await setField(id.admin, 'religion', true, false)
  await setField(id.admin, 'has_disability', true, false)
  await setField(id.admin, 'has_medical_condition', true, false)
  e = await err(id.enc, ins({ first_name: 'NoSpi', religion: 'Catholic' }).youth)
  ok('sensitive data needs the -SPI consent version', e && e.includes('-SPI'), e)
  r = await asUser(id.enc, ins({ first_name: 'Sensitive', religion: 'Zoroastrian Unique', has_disability: true, disability_details: 'Uses wheelchair Unique',
    has_medical_condition: true, medical_details: 'Asthma Unique', consent_version: 'KK-CONSENT-v1.1-SPI' }).youth)
  const sId = r.rows[0].id
  e = await err(id.view, `select religion from youth where id='${sId}'`)
  ok('viewer cannot read sensitive columns of youth', e && /permission denied/.test(e), e)
  e = await err(id.enc, `select medical_details from youth`)
  ok('no API role reads sensitive columns from youth directly', e && /permission denied/.test(e), e)
  const ov = (await asUser(id.view, `select * from youth_overview where id='${sId}'`)).rows[0]
  ok('youth_overview has no sensitive columns', ov && !('religion' in ov) && !('has_disability' in ov) && !('medical_details' in ov) && !('disability_details' in ov))
  ok('viewer gets no rows from youth_sensitive', (await asUser(id.view, `select * from youth_sensitive`)).rows.length === 0)
  ok('anon cannot read youth_sensitive', /permission denied/.test(await anonErr(`select * from youth_sensitive`) ?? ''))
  const encS = (await asUser(id.enc, `select * from youth_sensitive where id='${sId}'`)).rows[0]
  ok('encoder reads sensitive fields through youth_sensitive', encS?.religion === 'Zoroastrian Unique' && encS?.has_disability === true)
  e = await err(id.view, `select * from get_youth_sensitive_bulk(ARRAY['${sId}']::uuid[])`)
  ok('viewer cannot export sensitive fields', e && e.includes('Not allowed'), e)
  e = await err(id.enc, `select * from get_youth_sensitive_bulk(ARRAY['${sId}']::uuid[])`)
  ok('encoder cannot export sensitive fields', e && e.includes('Not allowed'), e)
  ok('admin can export sensitive fields', (await asUser(id.admin, `select * from get_youth_sensitive_bulk(ARRAY['${sId}']::uuid[])`)).rows[0]?.medical_details === 'Asthma Unique')
  ok('viewer dashboard/unreached contain no sensitive values', !JSON.stringify((await asUser(id.view, `select * from unreached_youth(null)`)).rows).includes('Unique'))

  // (e) sensitive values never reach the audit log
  await asUser(id.enc, `update youth set religion='Changed Unique', medical_details='Diabetes Unique' where id='${sId}'`)
  ok('audit log has no sensitive values', (await q(`select count(*)::int c from audit_logs where coalesce(old_data::text,'') || coalesce(new_data::text,'') || coalesce(detail::text,'') like '%Unique%'`))[0].c === 0)
  ok('audit log records that a sensitive field changed', (await q(`select count(*)::int c from audit_logs where table_name='youth' and record_id='${sId}' and new_data->>'religion' = '[sensitive: changed]'`))[0].c === 1)

  // (f) settings changes do not alter existing records
  await setField(id.admin, 'religion', false, false)
  await setField(id.admin, 'has_medical_condition', false, false)
  await setField(id.admin, 'middle_name', true, true)
  const snap2 = await snap()
  await setField(id.admin, 'middle_name', true, false)
  await setField(id.admin, 'civil_status', false, false)
  ok('toggling settings leaves every youth row identical', (await snap()) === snap2)
  await asUser(id.enc, `update youth set civil_status='married', religion='Tampered' where id='${sId}'`)
  const kept2 = (await asUser(id.enc, `select religion, has_medical_condition from youth_sensitive where id='${sId}'`)).rows[0]
  ok('editing a record keeps values of fields hidden later', kept2.religion === 'Changed Unique' && kept2.has_medical_condition === true, JSON.stringify(kept2))
  ok('hidden civil status keeps the saved value on edit', (await q(`select civil_status from youth where id='${sId}'`))[0].civil_status === null)
  await setField(id.admin, 'civil_status', true, false)
  const pend = (await q(`select id from pending_registrations where first_name='HasEmail'`))[0]
  await setField(id.admin, 'registered_voter', true, true)
  ok('approval is not blocked by settings changed after submission', !!(await asUser(id.enc, `select approve_registration('${pend.id}') as id`)).rows[0].id)
  await setField(id.admin, 'registered_voter', true, false)

  // inactive user loses all access
  await db.exec(`update profiles set is_active=false where id='${id.enc2}'`)
  e = await err(id.enc2, mk({ first_name: 'Blocked', last_name: 'User' }))
  ok('deactivated user is locked out', e && /row-level security/.test(e), e)
  ok('every public table has RLS enabled', (await q(`select count(*)::int c from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`))[0].c === 0)
} catch (x) {
  console.log('FATAL', x.message); fail++
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
