# Security, RLS and audit

## Roles

Roles live in `public.profiles.role`. `get_user_role()` (SECURITY DEFINER) returns the role of `auth.uid()` for active accounts only. Policies call this function; the client never sends a role. New sign-ups are always `viewer` (any role in sign-up metadata is ignored). A trigger blocks role or status changes unless the caller is an Admin (or the SQL editor or service role), and nobody can change their own role.

## Access matrix (enforced by RLS and grants)

| Table | anon | viewer | encoder | admin |
|---|---|---|---|---|
| profiles | none | own row | own row | all; update role, status, name |
| puroks | read active | read | read | read, add, edit, soft delete |
| youth | none | read active | read, add, edit | read incl. deleted, add, edit, soft delete and restore |
| youth_contacts | none | none | via RPC only | via RPC only |
| activities | none | read | read, add, edit | same as encoder |
| attendance | none | read | read, add, remove | same |
| pending_registrations | insert only | none | read, review (RPC) | same |
| audit_logs | none | none | none | read only |
| storage consent-scans | none | none | read, upload | read, upload, delete |

No table is left without a policy: `youth_contacts` has an explicit deny-all policy, and `02_security.sql` ends with a check that fails if any public table lacks RLS or a policy.

## Encryption

Mobile numbers are encrypted with `pgp_sym_encrypt` (pgcrypto). The key is created once and stored in Supabase Vault (`kk_contact_key`); only SECURITY DEFINER functions in the `private` schema can read it, and that schema is not exposed by the API. Numbers sit in a separate table, `youth_contacts`, with no direct grants. The only ways in are `set_youth_contact()` and `get_youth_contact()`, restricted to Admin and Encoder, and every reveal is audited. Self-registrations are encrypted by a trigger at insert time, so plaintext is never stored. Exports exclude contact numbers (data minimization).

Honest limit: this protects data at rest and from other roles. A person with database owner access can still call the decrypt function. For stricter separation, use an external KMS.

## Audit log

Triggers on youth, puroks, activities, attendance and profiles write insert, update (changed fields only), delete and restore events with the actor and time. RPCs log contact views, exports, approvals, rejections, imports and purges. Contact numbers never appear in log data. `audit_logs` has no insert, update or delete grants for API roles, and a trigger blocks update and delete even for the owner.

## Public form

Anon can only INSERT into `pending_registrations`. A BEFORE INSERT trigger forces `status = 'pending'`, clears review fields, stamps server time, validates age and guardian, and encrypts the phone. Add rate limiting (Cloudflare Turnstile or Supabase CAPTCHA) before a public launch; a honeypot field is included.

## Keys

Only the anon key reaches the browser. `SUPABASE_SERVICE_ROLE_KEY` is used in one server action (create user) and the file imports `server-only`, so the build fails if a client component imports it.

## Retention

Soft-deleted youth are kept 365 days, then an Admin runs `purge_soft_deleted()` from Audit and data. Audit logs: keep 3 years (suggested). Edit the policy text in `settings_note`.

## Tests

`supabase/tests/rls.test.mjs` applies the SQL to a local Postgres (PGlite) and checks 76 behaviors: role isolation, duplicate blocking, age and guardian rules, encryption, audit completeness and immutability, registration approval, import results, soft delete and storage policies. Run: `npm i -D @electric-sql/pglite` then `node supabase/tests/rls.test.mjs`.
