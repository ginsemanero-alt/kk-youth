# KK Youth Profiling System

Web-based youth profiling and management for a barangay Sangguniang Kabataan (ages 15 to 30). Capstone project (BSIT).

Stack: Next.js 16 (App Router), React 19, Tailwind CSS v4, Supabase (Auth, Postgres with Row Level Security, Storage, Vault), Recharts, SheetJS, jsPDF.

## Modules

Youth registry with duplicate detection, purok management, dashboard analytics (computed in SQL), report generator (PDF and Excel), activity and attendance tracking with participation rate and not-yet-reached list, self-registration by link or QR code with encoder approval, Excel import with error report, out-of-school youth flag with suggested referrals, roles (Admin, Encoder, Viewer), consent capture, encrypted contact numbers, audit log, soft delete and private consent-scan storage.

## Setup

1. **Install**: `npm install` (Node 20.9 or newer).
2. **Supabase project**: create one at https://supabase.com. In Dashboard > Database > Extensions make sure `pgcrypto` and `supabase_vault` are enabled (they are by default).
3. **Run the SQL** in Dashboard > SQL Editor, in this order, one file at a time:
   1. `supabase/01_schema.sql`
   2. `supabase/02_security.sql`
   3. `supabase/03_seed.sql` (optional sample puroks)

   All files can be re-run safely.
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
- **Printing**: Reports has a Print button with a clean print layout. Printing is recorded in the audit log like an export.
- **Bundle size**: Recharts, SheetJS and jsPDF are loaded on demand (dynamic import).
- **Windows**: `npm run test:db` works on Windows and Linux. On a low-memory PC, test with `npm run build` then `npm start` instead of `npm run dev`.
- **Rate limiting**: before a public launch, put a CAPTCHA (Cloudflare Turnstile or Supabase CAPTCHA) in front of the self-registration form.
- **Imports** are marked with consent source "import". The importing user confirms that signed consent forms are on file; under-18 rows need a guardian name.
- Exports never include contact numbers.
- The UI was checked in a browser against a stand-in backend, and the database rules were tested locally (76 checks in `supabase/tests`). It has not been run against your own Supabase project, so test each role once after setup.

## Documentation

`docs/01-chapter1-foundation.md` problem statement, objectives, scope and limitations. `docs/02-database-erd.md` schema and ERD. `docs/03-security-rls.md` roles, RLS, encryption, audit. `docs/04-architecture.md` architecture, flows, folders.
