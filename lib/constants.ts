import type { CivilStatus, EducationLevel, EducationStatus, EmploymentSector, EmploymentStatus, Role, Sex } from './types'

/** The barangay and SK this deployment belongs to (shown with the logo). */
export const ORG = {
  barangay: 'Barangay Bubog',
  sk: 'Sangguniang Kabataan ng Barangay Bubog',
  short: 'SK Barangay Bubog',
}

/**
 * Consent versions. v1.1 follows the paper SK Youth Profile Form. When the Admin shows any
 * sensitive field (religion, disability, medical), the form uses the -SPI version, which adds
 * CONSENT_SPI_TEXT. Old records keep the version they were saved with. The database requires
 * a version ending in -SPI before it stores sensitive information.
 * DRAFT WORDING: have the barangay legal officer or Data Protection Officer review it before use.
 */
export const CONSENT_VERSION = 'KK-CONSENT-v1.1'
export const CONSENT_VERSION_SPI = 'KK-CONSENT-v1.1-SPI'
export const consentVersionFor = (sensitiveShown: boolean) => (sensitiveShown ? CONSENT_VERSION_SPI : CONSENT_VERSION)

export const CONSENT_TEXT = [
  'I allow the Sangguniang Kabataan (SK) of this barangay to collect, process, use and keep the personal information in this form for the profiling of the Katipunan ng Kabataan (KK), as provided by Republic Act No. 10742 (Sangguniang Kabataan Reform Act of 2015), and for planning SK programs and reports.',
  'I understand that my information will be handled in line with Republic Act No. 10173 (Data Privacy Act of 2012): only what is needed is collected, it is stored securely, only authorized SK officers and encoders can access it, and my contact number is stored in encrypted form.',
  'I understand that the information I give will not be used as evidence against me in any legal proceeding.',
  'I understand that I may ask to view, correct or delete my information, or withdraw this consent, at any time by contacting the SK.',
]

export const CONSENT_SPI_TEXT =
  'This form also asks for sensitive personal information (religion, disability or medical condition). Answering these is voluntary. If I answer, I allow the SK to process this information only to plan programs and services for the youth; it is shown only to the SK Admin and encoders, never to viewers, and it is not included in reports unless an Admin prepares them.'

export const consentTextFor = (sensitiveShown: boolean) => (sensitiveShown ? [...CONSENT_TEXT, CONSENT_SPI_TEXT] : CONSENT_TEXT)

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
  { value: 'others', label: 'Others (please specify)' },
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
  { value: 'alternative_learning', label: 'Alternative Learning System (ALS)' },
  { value: 'college', label: 'College' },
  { value: 'vocational', label: 'Vocational / Technical' },
  { value: 'postgraduate', label: 'Post-Graduate (Masteral)' },
  { value: 'doctorate', label: 'Doctorate' },
]

/** Levels that have a course or program. Keep in sync with form_field_applies() in 05_form_settings.sql. */
export const LEVELS_WITH_COURSE: EducationLevel[] = ['college', 'vocational', 'postgraduate', 'doctorate']

export const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'unemployed', label: 'Unemployed' },
]

export const SECTOR_OPTIONS: { value: EmploymentSector; label: string }[] = [
  { value: 'government', label: 'Government' },
  { value: 'private', label: 'Private' },
  { value: 'self_employed', label: 'Self-employed / own business' },
]

export const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

/** true -> Yes, false -> No, null -> '' */
export const yesNo = (b: boolean | null | undefined) => (b === true ? 'Yes' : b === false ? 'No' : '')

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
