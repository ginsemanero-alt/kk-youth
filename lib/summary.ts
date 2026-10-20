import { AGE_BRACKETS, CIVIL_OPTIONS, EDU_LEVEL_OPTIONS, EDU_STATUS_OPTIONS, EMPLOYMENT_OPTIONS, SEX_OPTIONS } from './constants'

/**
 * Result of summary_report() (supabase/08_viewer_aggregate_only.sql). Counts only, no names.
 * For Viewers a count of 1 or 2 arrives as the text "<3" (small-count suppression).
 */
export type ReportCount = number | '<3'
export interface SummaryItem { label: string | null; count: ReportCount }
export interface SummaryQuestion { id: string; label: string; type: 'single_choice' | 'yes_no'; counts: { label: string; count: ReportCount }[] }
export interface SummaryReport {
  total: ReportCount
  osy: ReportCount
  masked: boolean
  groups: Partial<Record<GroupKey, SummaryItem[]>>
  questions: SummaryQuestion[]
}

export type GroupKey =
  | 'purok' | 'age_bracket' | 'sex' | 'education_status' | 'education_level' | 'employment_status' | 'civil_status'
  | 'registered_voter' | 'youth_org_member' | 'osy_by_purok' | 'osy_by_level' | 'osy_by_employment'

const YES_NO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]
const AGE = AGE_BRACKETS.map((b) => ({ value: b.value, label: b.label }))

export const GROUPS: { key: GroupKey; title: string; options?: { value: string; label: string }[] }[] = [
  { key: 'purok', title: 'By purok' },
  { key: 'age_bracket', title: 'By age group', options: AGE },
  { key: 'sex', title: 'By sex', options: SEX_OPTIONS },
  { key: 'education_status', title: 'By educational status', options: EDU_STATUS_OPTIONS },
  { key: 'education_level', title: 'By education level', options: EDU_LEVEL_OPTIONS },
  { key: 'employment_status', title: 'By work status', options: EMPLOYMENT_OPTIONS },
  { key: 'civil_status', title: 'By civil status', options: CIVIL_OPTIONS },
  { key: 'registered_voter', title: 'Registered SK voter', options: YES_NO },
  { key: 'youth_org_member', title: 'Youth organization member', options: YES_NO },
  { key: 'osy_by_purok', title: 'Out-of-school youth by purok' },
  { key: 'osy_by_level', title: 'Out-of-school youth by last level', options: EDU_LEVEL_OPTIONS },
  { key: 'osy_by_employment', title: 'Out-of-school youth by work status', options: EMPLOYMENT_OPTIONS },
]

export function groupLabel(key: GroupKey, value: string | null): string {
  if (value === null || value === '') return 'Not specified'
  const g = GROUPS.find((x) => x.key === key)
  return g?.options?.find((o) => o.value === value)?.label ?? value
}

/** Numeric value for bar widths and sorting ("<3" counts as 1). */
export const countValue = (c: ReportCount) => (typeof c === 'number' ? c : 1)
export const countText = (c: ReportCount) => String(c)
