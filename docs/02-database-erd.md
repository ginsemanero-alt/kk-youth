# Database design

Run order: `supabase/01_schema.sql`, `02_security.sql`, `03_seed.sql`.

## ERD

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "1 to 1 (trigger)"
  PUROKS ||--o{ YOUTH : "lives in"
  YOUTH ||--o| YOUTH_CONTACTS : "encrypted phone"
  YOUTH ||--o{ ATTENDANCE : attends
  ACTIVITIES ||--o{ ATTENDANCE : has
  PUROKS ||--o{ PENDING_REGISTRATIONS : "chosen purok"
  PENDING_REGISTRATIONS }o--o| YOUTH : "approved into"
  PROFILES ||--o{ AUDIT_LOGS : "acts"

  PROFILES { uuid id PK text full_name app_role role bool is_active }
  PUROKS { uuid id PK text name timestamptz deleted_at }
  YOUTH {
    uuid id PK
    text youth_code UK
    text first_name
    text last_name
    date birthdate
    sex_type sex
    uuid purok_id FK
    education_status_type education_status
    employment_status_type employment_status
    text_array skills
    text consent_version
    timestamptz consent_at
    text guardian_name
    timestamptz deleted_at
  }
  YOUTH_CONTACTS { uuid youth_id PK bytea contact_enc }
  ACTIVITIES { uuid id PK text title date activity_date text category }
  ATTENDANCE { uuid id PK uuid activity_id FK uuid youth_id FK }
  PENDING_REGISTRATIONS { uuid id PK registration_status_type status bytea contact_enc }
  AUDIT_LOGS { bigint id PK text action text table_name jsonb old_data jsonb new_data }
```

## Enums

`app_role` (admin, encoder, viewer), `sex_type`, `civil_status_type`, `education_status_type` (in_school, out_of_school, graduated), `education_level_type`, `employment_status_type` (employed, self_employed, unemployed), `registration_status_type`.

## Key rules in the database

| Rule | How |
|---|---|
| Unique ID per youth | `youth_code` from a sequence (`KK-2026-00001`) plus UUID primary key |
| Duplicate detection | Unique index on lower(first), lower(last), middle, birthdate among non-deleted rows |
| Age 15 to 30 | `validate_youth_row` trigger (computed from birthdate) |
| Guardian consent for minors | Same trigger: age at consent date below 18 requires guardian name and consent time |
| Age and bracket | Not stored (they change). The `youth_overview` view computes them |
| OSY flag and referrals | `is_osy` and `suggest_referrals()` in the view |
| Skills normalized | Lowercased, trimmed, de-duplicated by trigger |
| Aggregates | `dashboard_summary()`, `activity_stats` view, `unreached_youth()` (SQL, not client counting) |
| Soft delete | `deleted_at`; RLS hides deleted rows from non-admins; no DELETE policy on youth |

## Indexes

`youth_no_duplicates` (unique), `youth_purok_idx`, `youth_birthdate_idx`, `youth_education_idx`, `youth_employment_idx` (partial on `deleted_at is null`), `youth_name_idx`, `attendance_youth_idx`, `activities_date_idx`, `pending_status_idx`, `audit_created_idx`, `audit_table_idx`.

## Views

`youth_overview` and `activity_stats` use `security_invoker = true`, so the caller's Row Level Security applies to them. Without this, a view would bypass RLS.
