# Chapter 1 foundation: KK Youth Profiling System

Replace `[Barangay Name]` with your own.

## Problem statement

The Sangguniang Kabataan (SK) of [Barangay Name] must plan for the youth sector, including the Comprehensive Barangay Youth Development Plan (CBYDP), under Republic Act No. 10742 (SK Reform Act of 2015). Planning needs accurate data on youth aged 15 to 30. The SK currently keeps records manually or in separate Excel files, which causes:

1. Scattered and inconsistent records with no single source of truth.
2. Duplicate and outdated entries (ages and statuses are not updated automatically).
3. Slow, error-prone report generation by purok, age bracket, education and employment.
4. No tracking of who attended SK activities and who has never been reached.
5. No systematic identification of out-of-school youth (OSY) for referral to TESDA, ALS or job programs.
6. Data privacy risk: personal data of minors and young adults in unprotected spreadsheets (Data Privacy Act of 2012, RA 10173).

**How can a web-based profiling system help the SK keep accurate, secure and up-to-date youth records, produce reports for planning, track participation and identify youth who need support, while complying with data privacy requirements?**

## General objective

Design, develop and evaluate the KK Youth Profiling System, a web-based system that centralizes youth profiling and management for the SK of [Barangay Name].

## Specific objectives

1. Youth Registry with personal, education, employment, skills, interests and civic data; automatic age and age bracket; duplicate detection.
2. Purok management so records can be grouped by purok or sitio.
3. Dashboard and analytics computed in the database.
4. Report generator with filters and PDF and Excel export.
5. Program and activity tracking: attendance, participation rate, youth not yet reached.
6. Self-registration by link or QR code with encoder approval.
7. Excel import with validation and a downloadable error report.
8. Automatic OSY flag with suggested referrals.
9. Role-based access (Admin, Encoder, Viewer) enforced by Row Level Security.
10. Data privacy safeguards: consent (with guardian consent for 15 to 17), encryption of contact numbers, audit log, soft delete and private document storage.
11. Evaluation for functionality, usability and security using ISO/IEC 25010 with SK officers and encoders as respondents.

## Scope

- Users: SK officials and encoders of [Barangay Name]; youth residents through the self-registration form.
- Coverage: youth aged 15 to 30 residing in the barangay. Age brackets: 15 to 17 (child youth), 18 to 24 (core youth), 25 to 30 (young adult). Confirm the grouping with your adviser.
- Platform: responsive web application (Next.js, Supabase), deployed on Vercel and Supabase cloud.
- Roles: Admin (SK Chair or Secretary), Encoder, Viewer.

## Limitations and delimitations

1. One barangay only; no integration with municipal, provincial or national systems.
2. Requires internet access; no offline mode.
3. The system does not verify identity against government databases; duplicates are detected by name and birthdate.
4. Referral suggestions are informational; the system does not enroll youth in programs.
5. No SMS or email notifications.
6. Reports are exported in a fixed PDF or Excel format; the full CBYDP document is not generated.
7. Evaluation uses a limited number of respondents, not a barangay-wide pilot.
8. Full RA 10173 compliance also needs organizational measures (a data protection officer, privacy policy, breach procedure) outside the software.

## Significance

SK officials get faster, more accurate data for the CBYDP and reports. Youth get better targeted programs and referrals. The barangay gets a data-driven basis for youth development decisions. Future researchers get a reference for secure youth profiling on a backend-as-a-service stack.
