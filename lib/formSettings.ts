import type { SupabaseClient } from '@supabase/supabase-js'
import { LEVELS_WITH_COURSE } from './constants'
import type { EducationLevel, FormFieldSetting } from './types'

/**
 * Optional fields the Admin can show, hide or require (table public.form_fields).
 * Core fields (first_name, last_name, birthdate, sex, purok_id, education_status) are
 * always shown and required, so they are not listed here.
 * Same defaults as the seed in supabase/05_form_settings.sql; used only when that table
 * cannot be read (for example before 05 has been run).
 */
export const DEFAULT_FORM_FIELDS: FormFieldSetting[] = [
  { field_key: 'middle_name', label: 'Middle name', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 10, depends_on: null },
  { field_key: 'suffix', label: 'Suffix', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 20, depends_on: null },
  { field_key: 'civil_status', label: 'Civil status', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 30, depends_on: null },
  { field_key: 'contact_number', label: 'Mobile number', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 40, depends_on: null },
  { field_key: 'email', label: 'Email address', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 50, depends_on: null },
  { field_key: 'registered_voter', label: 'Registered SK voter', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 60, depends_on: null },
  { field_key: 'religion', label: 'Religion', section: 'personal', is_visible: false, is_required: false, is_sensitive: true, sort_order: 70, depends_on: null },
  { field_key: 'education_level', label: 'Education level', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 80, depends_on: null },
  { field_key: 'course', label: 'Course', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 90, depends_on: 'education_level' },
  { field_key: 'out_of_school_reason', label: 'Reason for not attending school', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 100, depends_on: null },
  { field_key: 'employment_status', label: 'Work status', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 110, depends_on: null },
  { field_key: 'employment_sector', label: 'Employment sector', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 120, depends_on: 'employment_status' },
  { field_key: 'government_agency', label: 'Government agency', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 130, depends_on: 'employment_sector' },
  { field_key: 'employment_duration', label: 'Length of employment', section: 'personal', is_visible: true, is_required: false, is_sensitive: false, sort_order: 140, depends_on: 'employment_status' },
  { field_key: 'has_disability', label: 'Person with disability (PWD)', section: 'other', is_visible: false, is_required: false, is_sensitive: true, sort_order: 200, depends_on: null },
  { field_key: 'has_medical_condition', label: 'Medical condition', section: 'other', is_visible: false, is_required: false, is_sensitive: true, sort_order: 210, depends_on: null },
  { field_key: 'youth_org_member', label: 'Member of a youth organization', section: 'other', is_visible: true, is_required: false, is_sensitive: false, sort_order: 220, depends_on: null },
  { field_key: 'skills', label: 'Skills', section: 'other', is_visible: true, is_required: false, is_sensitive: false, sort_order: 230, depends_on: null },
  { field_key: 'interests', label: 'Interests', section: 'other', is_visible: true, is_required: false, is_sensitive: false, sort_order: 240, depends_on: null },
  { field_key: 'civic_involvement', label: 'Civic involvement', section: 'other', is_visible: true, is_required: false, is_sensitive: false, sort_order: 250, depends_on: null },
]

/** Sensitive personal information (Data Privacy Act). The details fields follow their yes/no field. */
export const SENSITIVE_KEYS = ['religion', 'has_disability', 'has_medical_condition'] as const

export type FormRules = Record<string, { visible: boolean; required: boolean; label: string; sensitive: boolean }>

export function toRules(settings: FormFieldSetting[]): FormRules {
  return Object.fromEntries(
    settings.map((f) => [f.field_key, { visible: f.is_visible, required: f.is_visible && f.is_required, label: f.label, sensitive: f.is_sensitive }]),
  )
}

export const DEFAULT_RULES = toRules(DEFAULT_FORM_FIELDS)

/** Fields that are not in the settings (the core fields) are always shown. */
export const shown = (rules: FormRules, key: string) => rules[key]?.visible ?? true
export const required = (rules: FormRules, key: string) => Boolean(rules[key]?.visible && rules[key]?.required)
export const anySensitiveShown = (rules: FormRules) => SENSITIVE_KEYS.some((k) => shown(rules, k))

/** Does a conditional field apply to these answers? Same rules as form_field_applies() in the database. */
export function fieldApplies(key: string, v: { education_level: string; education_status: string; employment_status: string; employment_sector: string }): boolean {
  switch (key) {
    case 'course': return LEVELS_WITH_COURSE.includes(v.education_level as EducationLevel)
    case 'out_of_school_reason': return v.education_status === 'out_of_school'
    case 'employment_sector': return v.employment_status === 'employed'
    case 'government_agency': return v.employment_status === 'employed' && v.employment_sector === 'government'
    case 'employment_duration': return v.employment_status === 'employed' || v.employment_status === 'self_employed'
    default: return true
  }
}

/** Reads the settings (server or browser client). Falls back to the defaults if the table is missing. */
export async function loadFormSettings(supabase: SupabaseClient): Promise<FormFieldSetting[]> {
  const { data, error } = await supabase.from('form_fields').select('*').order('sort_order')
  if (error || !data || data.length === 0) return DEFAULT_FORM_FIELDS
  return data as FormFieldSetting[]
}
