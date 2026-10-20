# KK Youth Profiling System

Web-based youth profiling and management for a barangay Sangguniang Kabataan (ages 15 to 30).

Stack: Next.js 16 (App Router), React 19, Tailwind CSS v4, Supabase (Auth, Postgres with Row Level Security, Storage, Vault), Recharts, SheetJS, jsPDF.

## Modules

Youth registry with duplicate detection, purok management, dashboard analytics (computed in SQL), report generator (PDF and Excel), detailed SK activities (time, status, organizer, objectives, budget, outcome) with a private photo gallery, attendance tracking with participation rate and not-yet-reached list, self-registration by link or QR code with encoder approval, Excel import with error report, out-of-school youth flag with suggested referrals, roles (Admin, Encoder, Viewer: the Viewer sees aggregate statistics and summary reports only, never individual youth), consent capture, encrypted contact numbers, audit log, soft delete and private consent-scan storage.

## Setup

1. **Install**: `npm install` (Node 20.9 or newer).
2. **Supabase project**: create one at https://supabase.com. In Dashboard > Database > Extensions make sure `pgcrypto` and `supabase_vault` are enabled (they are by default).
3. **Run the SQL** in Dashboard > SQL Editor. **Quickest:** open `supabase/all_in_one.sql`, paste the whole file and click Run (it contains 01, 02 and 04 to 09 in order, and is safe to re-run). Run `supabase/03_seed.sql` separately only if you want sample puroks. After editing any SQL file, rebuild the bundle with `npm run sql:bundle` (the tests fail if it is out of date).

   Or run the files one at a time, in this order:
   1. `supabase/01_schema.sql`
   2. `supabase/02_security.sql`
   3. `supabase/03_seed.sql` (optional sample puroks)
   4. `supabase/04_form_fields_extra.sql` (fields from the paper Youth Profile Form)
   5. `supabase/05_form_settings.sql` (Admin form settings)
   6. `supabase/06_custom_questions.sql` (Admin's own questions)
   7. `supabase/07_user_management.sql` (archive accounts, audited delete and password reset)
   8. `supabase/08_viewer_aggregate_only.sql` (Viewer gets aggregate statistics only; denied-access log)
   9. `supabase/09_activity_details.sql` (activity details such as time, status, budget and outcome; private activity photos)

   All files can be re-run safely. If you re-run any file, run every later file again in order afterwards (for example, 02 resets grants and 04 and 06 redefine the approval and import functions).
4. **Environment**: copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings > API)
   - `SUPABASE_SERVICE_ROLE_KEY` (same page). Server only. Never prefix it with `NEXT_PUBLIC_`, never commit it.
   - `NEXT_PUBLIC_SITE_URL` (your deployed URL, used for the registration QR code)
5. **Create the first Admin**: in Supabase Dashboard > Authentication > Users, add a user with email and password (tick auto-confirm). Then run in the SQL Editor:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
6. `npm run dev`, open http://localhost:3000 and sign in. Go to Puroks to add your real puroks, and Users to create Encoder and Viewer accounts.

## Deploy

Push to GitHub, import the repo in Vercel, add the four environment variables, deploy. Set `NEXT_PUBLIC_SITE_URL` to the Vercel URL.

## Notes

- **SheetJS**: `package.json` installs `xlsx` from the official SheetJS CDN (version 0.20.3) because the npm registry copy (0.18.5) has known vulnerabilities. If your network blocks cdn.sheetjs.com, run `npm i xlsx@0.18.5` and only import files you trust.
- **Account page**: every user can change their own password at `/account` (the current password is re-checked first).
- **Users page** (Admin): create accounts, change roles, rename, reset another user's password, deactivate, archive (hidden and blocked from signing in, can be restored) and delete permanently (type the name to confirm). Nobody can archive, delete or demote their own account. Deleting keeps the youth records and audit entries the user made. Creating, deleting and resetting passwords need `SUPABASE_SERVICE_ROLE_KEY` on the server.
- **Printing**: Reports has a Print button with a clean print layout. Printing is recorded in the audit log like an export.
- **Bundle size**: Recharts, SheetJS and jsPDF are loaded on demand (dynamic import).
- **Windows**: `npm run test:db` works on Windows and Linux. On a low-memory PC, test with `npm run build` then `npm start` instead of `npm run dev`.
- **Rate limiting**: before a public launch, put a CAPTCHA (Cloudflare Turnstile or Supabase CAPTCHA) in front of the self-registration form.
- **Imports** are marked with consent source "import". The importing user confirms that signed consent forms are on file; under-18 rows need a guardian name.
- Exports never include contact numbers or email addresses. Religion, disability, medical and sensitive question answers are exported only when an Admin ticks "Include sensitive information" on the Reports page (the read is logged).
- The UI was checked in a browser against a stand-in backend, and the database rules were tested locally (251 checks in `supabase/tests`, plus 131 route checks in `npm run test:routes`). It has not been run against your own Supabase project, so test each role once after setup.

## Form settings (Admin)

**Form settings** (`/admin/form-settings`, Admin only) decides which optional details the self-registration form, the encoder form and the Excel import ask for: **Ipakita** (show) and **Required** per field, with a live preview. The database enforces the settings on every insert (a hidden field is dropped, a missing required field is rejected), so the browser is not trusted. Changing a setting never alters saved records: an edited record keeps the values of fields that were hidden later, and registrations submitted earlier can still be approved.

Always asked and required (not in the settings, because duplicate detection, the age bracket, the dashboard and the OSY flag need them): first name, last name, birthdate, sex, purok, educational status.

Fields from the paper SK **Youth Profile Form** (consent + personal information + other information):

| Section | Field | Notes |
|---|---|---|
| Personal | ID No. | Automatic youth code (`KK-2026-00001`), never asked |
| Personal | Last, first, middle name, suffix | Middle name and suffix optional by default |
| Personal | Birthdate, age group | Age group 15-17 / 18-24 / 25-30 is computed, never asked |
| Personal | Sex, purok | Core |
| Personal | Civil status | Includes "Others, please specify" |
| Personal | Mobile number, email | Mobile number encrypted |
| Personal | Registered SK voter | Yes / No |
| Personal | Religion | **Sensitive**, hidden by default |
| Personal | Educational status, level, course | Course only for college, vocational, post-graduate, doctorate |
| Personal | Reason for not attending school | Only for out-of-school youth |
| Personal | Work status, sector, government agency, length of employment | Sector and agency only when employed; agency only for government |
| Other | Person with disability, type | **Sensitive**, hidden by default |
| Other | Medical condition, details | **Sensitive**, hidden by default |
| Other | Youth organization member, name | Name required when member |
| Other | Skills, interests, civic involvement | |

Conditional fields appear only when they apply, and a database trigger clears them when they no longer apply (for example, the out-of-school reason is erased when the youth is in school).

**Sensitive information** (religion, disability, medical) is hidden and optional by default, readable only by Admin and Encoder (enforced with column grants and the `youth_sensitive` view, so Viewers cannot read it from any table, view or export), exported only by an Admin, and never written to the audit log (the log only says the field changed). When any sensitive field is shown, the consent text gains a paragraph about it and the version becomes `KK-CONSENT-v1.1-SPI`; the database refuses sensitive values without that version. Older records keep the consent version they were saved with.

**Consent text** (`lib/constants.ts`) follows the paper form: consent to collect, process, use and keep the information for KK profiling under RA 10742 and RA 10173, and that it will not be used as evidence in any legal proceeding. It is written in our own words. **Have the barangay legal officer or Data Protection Officer review it before use.**

## Custom questions (Admin)

Also on `/admin/form-settings`: the Admin can add their own questions (short text up to 300 characters, choose one, choose any, yes or no), edit the wording, help text, options and Required, reorder them, and deactivate them. Questions are never deleted; a deactivated question is no longer asked, but answers already given are kept and still shown (marked "No longer asked"). The type and the sensitive setting are fixed once a question exists.

Active questions appear on the self-registration form, the encoder form, the profile page ("Karagdagang impormasyon"), the registrations inbox, the report (with a count per answer for choose-one and yes/no questions, and a filter by answer), the Excel and PDF exports (`Q: <question>` columns) and the import template.

Answers are stored in `custom_answers` (jsonb) on `youth` and `pending_registrations` and checked by the database: the answer type must match, a choice must be one of the options, text is at most 300 characters, required questions must be answered, and unknown questions are rejected. A **sensitive** question follows the same rules as religion, disability and medical: only Admin and Encoder can read its answers (through the `youth_custom_answers` view), only an Admin can export them, the audit log never contains them, and they need the `-SPI` consent version.

## Logo and branding

The SK Barangay Bubog logo is `assets/sk-logo.jpg` (source) and `assets/sk-logo-round.png` (round version used in the app). It appears in the sidebar, the mobile header, the home, login, registration and privacy pages, and the PDF report header; `app/icon.png` and `app/apple-icon.png` are the browser and phone icons. The colors in `app/globals.css` (blue, yellow, red) come from the logo. The barangay and SK names are in `ORG` in `lib/constants.ts`.

## Documentation

`docs/01-chapter1-foundation.md` problem statement, objectives, scope and limitations. `docs/02-database-erd.md` schema and ERD. `docs/03-security-rls.md` roles, RLS, encryption, audit. `docs/04-architecture.md` architecture, flows, folders.
