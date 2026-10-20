import type { CivilStatus, EducationLevel, EducationStatus, EmploymentStatus, Role, Sex } from './types'

export const CONSENT_VERSION = 'KK-CONSENT-v1.0'

export const CONSENT_TEXT = [
  'I allow the Sangguniang Kabataan (SK) of this barangay to collect and process my personal information for youth profiling, planning of programs (including the Comprehensive Barangay Youth Development Plan), and SK reports.',
  'I understand that only the information needed for these purposes is collected, that it is stored securely, that only authorized SK officers and encoders can access it, and that my contact number is stored in encrypted form.',
  'I understand that I may ask to view, correct or delete my information at any time by contacting the SK, in line with the Data Privacy Act of 2012 (Republic Act No. 10173).',
]

export const GUARDIAN_CONSENT_TEXT =
  'As the parent or guardian of the youth named above, who is below 18 years old, I give my consent to the collection and processing of their personal information for the purposes stated above.'

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

export const CIVIL_OPTIONS: { value: CivilStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'live_in', label: 'Live-in' },
  { value: 'separated', label: 'Separated' },
  { value: 'widowed', label: 'Widowed' },
]

export const EDU_STATUS_OPTIONS: { value: EducationStatus; label: string }[] = [
  { value: 'in_school', label: 'In school' },
  { value: 'out_of_school', label: 'Out of school' },
  { value: 'graduated', label: 'Graduated' },
]

export const EDU_LEVEL_OPTIONS: { value: EducationLevel; label: string }[] = [
  { value: 'elementary', label: 'Elementary' },
  { value: 'junior_high', label: 'Junior High School' },
  { value: 'senior_high', label: 'Senior High School' },
  { value: 'alternative_learning', label: 'Alternative Learning System' },
  { value: 'vocational', label: 'Vocational / Technical' },
  { value: 'college', label: 'College' },
  { value: 'postgraduate', label: 'Postgraduate' },
]

export const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'unemployed', label: 'Unemployed' },
]

export const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Full access, users, audit logs' },
  { value: 'encoder', label: 'Encoder', hint: 'Add and edit profiles, approve registrations' },
  { value: 'viewer', label: 'Viewer', hint: 'Read-only dashboard and reports' },
]

export const ACTIVITY_CATEGORIES = [
  { value: 'sports', label: 'Sports' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Health' },
  { value: 'environment', label: 'Environment' },
  { value: 'livelihood', label: 'Livelihood' },
  { value: 'governance', label: 'Governance' },
  { value: 'culture', label: 'Arts and culture' },
  { value: 'other', label: 'Other' },
]

export const AGE_BRACKETS = [
  { value: '15-17', label: '15 to 17 (Child youth)', min: 15, max: 17 },
  { value: '18-24', label: '18 to 24 (Core youth)', min: 18, max: 24 },
  { value: '25-30', label: '25 to 30 (Young adult)', min: 25, max: 30 },
]

export const SKILL_SUGGESTIONS = ['carpentry', 'welding', 'cooking', 'graphic design', 'programming', 'driving', 'sewing', 'singing', 'dancing', 'farming']
export const INTEREST_SUGGESTIONS = ['basketball', 'volleyball', 'music', 'esports', 'volunteering', 'arts', 'entrepreneurship', 'environment']
export const CIVIC_SUGGESTIONS = ['SK activities', 'church group', 'school organization', 'volunteer work', 'barangay clean-up', 'sports club']

export const label = <T extends string>(opts: { value: T; label: string }[], v: T | null | undefined) =>
  opts.find((o) => o.value === v)?.label ?? (v ?? '')
