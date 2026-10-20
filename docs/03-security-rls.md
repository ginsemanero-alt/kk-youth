# Security, RLS and audit

## Roles

Roles live in `public.profiles.role`. `get_user_role()` (SECURITY DEFINER) returns the role of `auth.uid()` for active accounts only. Policies call this function; the client never sends a role. New sign-ups are always `viewer` (any role in sign-up metadata is ignored). A trigger blocks role or status changes unless the caller is an Admin (or the SQL editor or service role), and nobody can change their own role.

## Access matrix (enforced by RLS and grants)

| Table | anon | viewer | encoder | admin |
|---|---|---|---|---|
| profiles | none | own row | own row | all; update role, status, name, archive/restore (not own); delete and password reset through audited server actions |
| puroks | read active | read | read | read, add, edit, soft delete |
| youth | none | read active (no sensitive columns) | read, add, edit | read incl. deleted, add, edit, soft delete and restore |
| youth_sensitive (view) | none | no rows | read active | read incl. deleted |
| form_fields | read | read | read | read; update show/required only |
| custom_questions | read active | read all | read all | read all, add, edit, deactivate (no delete) |
| youth_custom_answers (view) | none | non-sensitive answers | all answers | all answers |
| youth_contacts | none | none | via RPC only | via RPC only |
| activities | none | read | read, add, edit | same as encoder |
| attendance | none | read | read, add, remove | same |
| pending_registrations | insert only | none | read, review (RPC) | same |
| audit_logs | none | none | none | read only |
| storage consent-scans | none | none | read, upload | read, upload, delete |

No table is left without a policy: `youth_contacts` has an explicit deny-all policy, and `02_security.sql` ends with a check that fails if any public table lacks RLS or a policy.

## Sensitive personal information

Religion, disability and medical fields (added by `04_form_fields_extra.sql`) are sensitive personal information under the Data Privacy Act. Rules, all in the database:

- **Not readable by Viewers.** SELECT on `youth` is granted per column (`private.grant_youth_select()`), leaving out the sensitive columns for every API role. Admin and Encoder read them through the `youth_sensitive` view, which returns no rows to anyone else. `youth_overview` (used by Viewers, dashboards and exports) does not contain them. Viewers cannot read `pending_registrations` at all.
- **Exported only by an Admin.** `get_youth_sensitive_bulk()` refuses every role except Admin and logs the read (row count only).
- **Never in the audit log.** `audit_row()` replaces the values with `[sensitive]` (insert) or `[sensitive: changed]` (update).
- **Consent.** Values are refused unless the record's consent version ends in `-SPI`, the version whose text explains the sensitive fields.
- **Off by default.** The three fields are hidden and not required in `form_fields` until an Admin turns them on.

Changed existing logic, and why: `youth` SELECT went from table-level to column-level (needed so Viewers cannot read the sensitive columns; Viewer and Encoder share the same database role, so this cannot be done with a role-specific grant). `audit_row()` masks the sensitive keys and uses `field_key` as the record id for `form_fields`. `approve_registration()` and `import_youth()` copy the new columns. RLS policies, encryption and the other audit rules are unchanged.

## Form settings

`form_fields`: anon and authenticated may SELECT (the public form needs it). Only an Admin may UPDATE, and only the `is_visible` and `is_required` columns (column grant). Insert and delete have explicit deny policies and no grants. Every change is audited with `audit_row()`. The settings are enforced by `apply_form_settings()` on `youth` and `pending_registrations`, so a client that skips the form cannot store a hidden field or skip a required one.

## Custom questions

`custom_questions`: anon reads active questions; staff read all (to label old answers). Only an Admin may insert or update, and only through column grants that leave out `question_type` and `is_sensitive` on update. Delete has an explicit deny policy, no grant, and a trigger that blocks it even for the database owner. Changes are audited. `custom_answers` on `youth` is not granted to any API role (`private.grant_youth_select()`); answers are read through `youth_custom_answers`, which gives sensitive answers only to Admin and Encoder. `get_sensitive_answers_bulk()` (Admin only, logged) is used for exports. `audit_mask()` replaces the answers to sensitive questions in the audit log with a marker.

## User management

`07_user_management.sql` adds `archived_at` / `archived_by` to `profiles`. A trigger lets only an Admin archive or restore, never their own account; archiving also deactivates the account (so `get_user_role()` returns nothing and every policy denies access), restoring reactivates it, and an archived account cannot be reactivated without restoring. Deleting an account and resetting another user's password use the service role in a server action, but only after `log_user_admin_action()` has checked, with the Admin's own session, that the caller is an Admin acting on someone else, and written the audit entry. Deleting removes the sign-in and profile; youth, activity and attendance rows keep existing (their `created_by` becomes null) and the audit log keeps the actor's name.

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

`supabase/tests/rls.test.mjs` applies the SQL to a local Postgres (PGlite) and checks 204 behaviors: role isolation, duplicate blocking, age and guardian rules, encryption, audit completeness and immutability, registration approval, import results, soft delete and storage policies, plus form settings (Admin-only changes, required and hidden fields, conditional clean-up, sensitive fields hidden from Viewers in tables, views and exports, no sensitive values in the audit log, settings changes leaving saved records unchanged), and custom questions (Admin-only management, no delete, wrong answers rejected, sensitive answers hidden from Viewers and the audit log, deactivated questions keeping their answers). It also checks a role matrix (what Viewer, Encoder and Admin can and cannot do). It applies 01 to 06 twice in order to prove they can be re-run. Run: `npm run test:db`.
