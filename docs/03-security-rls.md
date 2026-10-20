# Security, RLS and audit

## Roles

Roles live in `public.profiles.role`. `get_user_role()` (SECURITY DEFINER) returns the role of `auth.uid()` for active accounts only. Policies call this function; the client never sends a role. New sign-ups are always `viewer` (any role in sign-up metadata is ignored). A trigger blocks role or status changes unless the caller is an Admin (or the SQL editor or service role), and nobody can change their own role.

## Access matrix (enforced by RLS and grants)

| Table | anon | viewer | encoder | admin |
|---|---|---|---|---|
| profiles | none | own row | own row | all; update role, status, name, archive/restore (not own); delete and password reset through audited server actions |
| puroks | read active | read | read | read, add, edit, soft delete |
| youth | none | **no rows** | read, add, edit | read incl. deleted, add, edit, soft delete and restore |
| youth_overview, unreached_youth() | none | **no rows** (follow youth RLS) | read | read incl. deleted |
| youth_sensitive (view) | none | no rows | read active | read incl. deleted |
| form_fields | read | read | read | read; update show/required only |
| custom_questions | read active | read all | read all | read all, add, edit, deactivate (no delete) |
| youth_custom_answers (view) | none | **no rows** | all answers | all answers |
| youth_contacts | none | none | via RPC only | via RPC only |
| activities | none | read (titles and dates) | read, add, edit | same as encoder |
| attendance | none | **no rows** | read, add, remove | same |
| activity_photos | none | **no rows** | read, add, edit caption, delete own | read, add, edit caption, delete any |
| activity_stats, dashboard_summary(), summary_report() | none | aggregate counts only (1 or 2 shown as "<3") | aggregate counts | aggregate counts |
| pending_registrations | insert only | none | read, review (RPC) | same |
| audit_logs | none | none | none | read only |
| storage consent-scans | none | none | read, upload | read, upload, delete |
| storage activity-photos | none | none | read, upload into an existing activity's folder, delete own | read, upload, delete any |

## Role-based access (RBAC)

Three roles, read from `profiles.role` by `get_user_role()` on every request and every query; the browser never sends a role, a missing or inactive profile gets no access, and the Viewer sees **aggregate statistics only**.

| Feature | Admin | Encoder | Viewer |
|---|---|---|---|
| Dashboard (aggregate) | Yes, plus recent activity | Yes, plus pending registrations and recent updates | Yes (counts only) |
| Youth statistics, summary reports (aggregate, export) | Yes | Yes | Yes, small counts shown as "<3" |
| Youth registry, profiles, search | Yes, incl. deleted | Yes | No |
| Add and edit profiles, duplicate check | Yes | Yes | No |
| Out-of-school list with names | Yes | Yes | No (counts on Youth statistics) |
| Approve or reject registrations | Yes | Yes (existing workflow) | No |
| Activities and attendance | Yes | Yes | No (participation counts only) |
| Excel import | Yes | Yes | No |
| Individual report and export | Yes | Yes | No |
| Sensitive fields (religion, PWD, medical) | Read and export | Read | No |
| Contact number reveal (audited) | Yes | Yes | No |
| Consent scans | Read, upload, delete | Read, upload | No |
| Delete, restore youth; Archive page | Yes | No | No |
| Permanent purge (retention) | Yes | No | No |
| Puroks, form settings, users and roles | Yes | No | No |
| Audit logs | Yes | No | No |
| Own password (My account) | Yes | Yes | Yes |

Pages: every page under `app/(app)` calls `requireRole(roles, path)` on the server before reading data, and `npm run test:routes` checks each page and menu link against this matrix. A signed-in user who opens a page their role does not allow is redirected to the dashboard and the attempt is written to the audit log as `denied` (at most once a minute per user and page; only the path and role are recorded). The database enforces the same rules again, so a direct Supabase query, URL or manipulated request gets no individual rows for a Viewer.

Small-count suppression: `summary_report()` returns counts of 1 or 2 as `"<3"` for Viewers, so a filter such as "one purok, one age group" cannot single out a person. Admin and Encoder see the real numbers.

Changed existing logic, and why (08 and the edits it goes with): the `youth read` and `attendance read` policies (02) and the `youth_custom_answers` view (06) now admit Admin and Encoder only, because Viewers must not retrieve individual records. `dashboard_summary()` (01) and the `activity_stats` view (moved from 01 to 02, after `get_user_role()`) now run with the owner's rights and check the caller's role themselves, so Viewers still get correct aggregate counts. The audit action list gains `denied`.

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

## Activity photos

`09_activity_details.sql` adds `activity_photos` with RLS: Admin and Encoder read, add and edit captions; an Encoder may delete only photos they uploaded, an Admin any. Viewers and anonymous users get nothing. The `activity-photos` bucket is private (files are shown through signed links that expire after one hour), limited to 5 MB and JPEG, PNG or WebP. Uploads are allowed only into the folder of an activity that exists and is not deleted, and the storage delete rule checks the matching `activity_photos` row, so an Encoder cannot remove someone else's file. The uploader is stamped by a trigger from `auth.uid()`, not taken from the browser. Photo changes are audited.

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

`supabase/tests/rls.test.mjs` applies the SQL to a local Postgres (PGlite) and checks 251 behaviors: role isolation, duplicate blocking, age and guardian rules, encryption, audit completeness and immutability, registration approval, import results, soft delete and storage policies, plus form settings (Admin-only changes, required and hidden fields, conditional clean-up, sensitive fields hidden from Viewers in tables, views and exports, no sensitive values in the audit log, settings changes leaving saved records unchanged), and custom questions (Admin-only management, no delete, wrong answers rejected, sensitive answers hidden from Viewers and the audit log, deactivated questions keeping their answers). It also checks a role matrix (what Viewer, Encoder and Admin can and cannot do), the Viewer's aggregate-only access (no individual rows from any table, view or function; "<3" for small counts), dashboard counts against the real rows (deleted and pending excluded), the denied-access log, and activity details and photos (cleaning and checks, uploader stamp, folder rule, 40-photo limit, Viewer and anonymous blocked, delete own vs any, bucket limits and storage rules). `npm run test:routes` checks every page guard and menu link against the RBAC matrix and that the service-role client never reaches client code. It applies 01 to 09 twice in order to prove they can be re-run. Run: `npm run test:db`.
