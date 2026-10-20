import { ageOn } from './format'
import { DEFAULT_RULES, fieldApplies, required, shown, type FormRules } from './formSettings'

/** yes/no questions are kept as '' (not answered), 'yes' or 'no' while the form is open. */
export type YesNo = '' | 'yes' | 'no'

export interface ProfileValues {
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  birthdate: string
  sex: string
  civil_status: string
  civil_status_other: string
  purok_id: string
  contact_number: string
  email: string
  registered_voter: YesNo
  religion: string
  education_status: string
  education_level: string
  course: string
  out_of_school_reason: string
  employment_status: string
  employment_sector: string
  government_agency: string
  employment_duration: string
  has_disability: YesNo
  disability_details: string
  has_medical_condition: YesNo
  medical_details: string
  youth_org_member: YesNo
  youth_org_name: string
  skills: string[]
  interests: string[]
  civic_involvement: string[]
  guardian_name: string
  guardian_relationship: string
}

export const emptyProfile: ProfileValues = {
  first_name: '', middle_name: '', last_name: '', suffix: '', birthdate: '', sex: '', civil_status: '', civil_status_other: '', purok_id: '',
  contact_number: '', email: '', registered_voter: '', religion: '',
  education_status: '', education_level: '', course: '', out_of_school_reason: '',
  employment_status: '', employment_sector: '', government_agency: '', employment_duration: '',
  has_disability: '', disability_details: '', has_medical_condition: '', medical_details: '', youth_org_member: '', youth_org_name: '',
  skills: [], interests: [], civic_involvement: [], guardian_name: '', guardian_relationship: '',
}

const PH_MOBILE = /^(\+63|0)9\d{9}$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const toYesNo = (b: boolean | null | undefined): YesNo => (b === true ? 'yes' : b === false ? 'no' : '')
const fromYesNo = (s: YesNo) => (s === 'yes' ? true : s === 'no' ? false : null)

const blank = (x: unknown) => (Array.isArray(x) ? x.length === 0 : !String(x ?? '').trim())

/**
 * Same checks as the database triggers, so the person sees the problem before submitting.
 * The database checks everything again.
 */
export function validateProfile(v: ProfileValues, rules: FormRules = DEFAULT_RULES, opts: { requirePurok?: boolean; skip?: string[] } = {}): string | null {
  if (!v.first_name.trim()) return 'First name is required.'
  if (!v.last_name.trim()) return 'Last name is required.'
  if (!v.birthdate) return 'Birthdate is required.'
  const age = ageOn(v.birthdate)
  if (Number.isNaN(age) || age < 15 || age > 30) return `Only youth aged 15 to 30 can be registered (computed age: ${Number.isNaN(age) ? '?' : age}).`
  if (!v.sex) return 'Please select a sex.'
  if ((opts.requirePurok ?? true) && !v.purok_id) return 'Please select a purok.'
  if (!v.education_status) return 'Please select an educational status.'

  for (const [key, rule] of Object.entries(rules)) {
    if (opts.skip?.includes(key) || !required(rules, key) || !fieldApplies(key, v)) continue
    if (blank(v[key as keyof ProfileValues])) return `${rule.label} is required.`
  }

  const phone = v.contact_number.replace(/[\s-]/g, '')
  if (shown(rules, 'contact_number') && phone && !PH_MOBILE.test(phone)) return 'Contact number must be a Philippine mobile number like 09171234567.'
  if (shown(rules, 'email') && v.email.trim() && (!EMAIL.test(v.email.trim()) || v.email.trim().length > 120)) return 'Please enter a valid email address.'
  if (shown(rules, 'youth_org_member') && v.youth_org_member === 'yes' && !v.youth_org_name.trim()) return 'Please give the name of the youth organization.'
  if (age < 18 && !v.guardian_name.trim()) return 'Parent or guardian name is required for youth below 18.'
  return null
}

export const cleanPhone = (s: string) => s.replace(/[\s-]/g, '')

const text = (s: string) => s.trim() || null

/**
 * Builds the database row from the form. Hidden fields are left out (the database
 * also drops them), and a conditional field that no longer applies is sent as null.
 * contact_number is not included; callers handle it (it is encrypted separately).
 */
export function profilePayload(v: ProfileValues, rules: FormRules, opts: { isMinor: boolean; includeSensitive: boolean }): Record<string, unknown> {
  const applies = (k: string) => fieldApplies(k, v)
  const row: Record<string, unknown> = {
    first_name: v.first_name, last_name: v.last_name, birthdate: v.birthdate, sex: v.sex, purok_id: v.purok_id,
    education_status: v.education_status,
    guardian_name: opts.isMinor ? v.guardian_name : null,
    guardian_relationship: opts.isMinor ? text(v.guardian_relationship) : null,
  }
  const optional: Record<string, unknown> = {
    middle_name: text(v.middle_name),
    suffix: text(v.suffix),
    civil_status: v.civil_status || null,
    civil_status_other: v.civil_status === 'others' ? text(v.civil_status_other) : null,
    email: text(v.email),
    registered_voter: fromYesNo(v.registered_voter),
    education_level: v.education_level || null,
    course: applies('course') ? text(v.course) : null,
    out_of_school_reason: applies('out_of_school_reason') ? text(v.out_of_school_reason) : null,
    employment_status: v.employment_status || null,
    employment_sector: applies('employment_sector') ? v.employment_sector || null : null,
    government_agency: applies('government_agency') ? text(v.government_agency) : null,
    employment_duration: applies('employment_duration') ? text(v.employment_duration) : null,
    youth_org_member: fromYesNo(v.youth_org_member),
    youth_org_name: v.youth_org_member === 'yes' ? text(v.youth_org_name) : null,
    skills: v.skills, interests: v.interests, civic_involvement: v.civic_involvement,
  }
  if (opts.includeSensitive) {
    Object.assign(optional, {
      religion: text(v.religion),
      has_disability: fromYesNo(v.has_disability),
      disability_details: v.has_disability === 'yes' ? text(v.disability_details) : null,
      has_medical_condition: fromYesNo(v.has_medical_condition),
      medical_details: v.has_medical_condition === 'yes' ? text(v.medical_details) : null,
    })
  }
  // A sub-field follows the field that controls it.
  const parent: Record<string, string> = {
    civil_status_other: 'civil_status', youth_org_name: 'youth_org_member', disability_details: 'has_disability', medical_details: 'has_medical_condition',
  }
  for (const [k, val] of Object.entries(optional)) {
    if (shown(rules, parent[k] ?? k)) row[k] = val
  }
  return row
}
