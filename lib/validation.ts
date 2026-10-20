import { ageOn } from './format'

export interface ProfileValues {
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  birthdate: string
  sex: string
  civil_status: string
  purok_id: string
  contact_number: string
  education_status: string
  education_level: string
  employment_status: string
  skills: string[]
  interests: string[]
  civic_involvement: string[]
  guardian_name: string
  guardian_relationship: string
}

export const emptyProfile: ProfileValues = {
  first_name: '', middle_name: '', last_name: '', suffix: '', birthdate: '', sex: '', civil_status: 'single', purok_id: '',
  contact_number: '', education_status: '', education_level: '', employment_status: 'unemployed',
  skills: [], interests: [], civic_involvement: [], guardian_name: '', guardian_relationship: '',
}

const PH_MOBILE = /^(\+63|0)9\d{9}$/

export function validateProfile(v: ProfileValues, opts: { requirePurok?: boolean } = {}): string | null {
  if (!v.first_name.trim()) return 'First name is required.'
  if (!v.last_name.trim()) return 'Last name is required.'
  if (!v.birthdate) return 'Birthdate is required.'
  const age = ageOn(v.birthdate)
  if (Number.isNaN(age) || age < 15 || age > 30) return `Only youth aged 15 to 30 can be registered (computed age: ${Number.isNaN(age) ? '?' : age}).`
  if (!v.sex) return 'Please select a sex.'
  if ((opts.requirePurok ?? true) && !v.purok_id) return 'Please select a purok.'
  if (!v.education_status) return 'Please select an educational status.'
  const phone = v.contact_number.replace(/[\s-]/g, '')
  if (phone && !PH_MOBILE.test(phone)) return 'Contact number must be a Philippine mobile number like 09171234567.'
  if (age < 18 && !v.guardian_name.trim()) return 'Parent or guardian name is required for youth below 18.'
  return null
}

export const cleanPhone = (s: string) => s.replace(/[\s-]/g, '')
