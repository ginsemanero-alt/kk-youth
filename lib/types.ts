export type Role = 'admin' | 'encoder' | 'viewer'
export type Sex = 'male' | 'female'
export type CivilStatus = 'single' | 'married' | 'widowed' | 'separated' | 'live_in'
export type EducationStatus = 'in_school' | 'out_of_school' | 'graduated'
export type EducationLevel =
  | 'elementary' | 'junior_high' | 'senior_high' | 'alternative_learning' | 'vocational' | 'college' | 'postgraduate'
export type EmploymentStatus = 'employed' | 'self_employed' | 'unemployed'
export type RegistrationStatus = 'pending' | 'approved' | 'rejected'

export interface Purok {
  id: string
  name: string
  description: string | null
  created_at: string
  deleted_at: string | null
}

export interface YouthOverview {
  id: string
  youth_code: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  full_name: string
  birthdate: string
  age: number
  age_bracket: string
  sex: Sex
  civil_status: CivilStatus
  purok_id: string
  purok_name: string
  education_status: EducationStatus
  education_level: EducationLevel | null
  employment_status: EmploymentStatus
  skills: string[]
  interests: string[]
  civic_involvement: string[]
  is_osy: boolean
  referrals: string[]
  consent_version: string
  consent_at: string
  consent_source: 'form' | 'self_registration' | 'import'
  guardian_name: string | null
  guardian_relationship: string | null
  guardian_consent_at: string | null
  consent_scan_path: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Activity {
  id: string
  title: string
  description: string | null
  category: string
  activity_date: string
  venue: string | null
  purok_id: string | null
}

export interface ActivityStat extends Activity {
  attendees: number
  total_youth: number
  participation_rate: number
}

export interface PendingRegistration {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  birthdate: string
  sex: Sex
  civil_status: CivilStatus
  purok_id: string
  education_status: EducationStatus
  education_level: EducationLevel | null
  employment_status: EmploymentStatus
  skills: string[]
  interests: string[]
  civic_involvement: string[]
  consent_version: string
  consent_at: string
  guardian_name: string | null
  guardian_relationship: string | null
  status: RegistrationStatus
  rejection_reason: string | null
  created_at: string
  puroks?: { name: string } | null
}

export interface Profile {
  id: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
}

export interface AuditLog {
  id: number
  actor_id: string | null
  actor_name: string | null
  action: string
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  detail: Record<string, unknown> | null
  created_at: string
}

export interface CountItem {
  label: string
  count: number
}

export interface DashboardSummary {
  total: number
  osy: number
  in_school: number
  out_of_school: number
  graduated: number
  employed: number
  unemployed: number
  male: number
  female: number
  age_brackets: CountItem[]
  employment: CountItem[]
  puroks: CountItem[]
  top_skills: CountItem[]
  top_interests: CountItem[]
  activities: number
  avg_participation: number
  unreached: number
}
