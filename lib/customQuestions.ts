import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomAnswers, CustomQuestion, QuestionType } from './types'

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Short answer (text)' },
  { value: 'single_choice', label: 'Choose one' },
  { value: 'multi_choice', label: 'Choose any' },
  { value: 'yes_no', label: 'Yes or no' },
]

export const MAX_TEXT_ANSWER = 300

/**
 * Reads the Admin's questions, ordered for the form. activeOnly for forms; staff pages
 * also need inactive ones to label old answers. Returns [] if the table is missing
 * (06_custom_questions.sql not run yet).
 */
export async function loadQuestions(supabase: SupabaseClient, opts: { activeOnly?: boolean } = {}): Promise<CustomQuestion[]> {
  let q = supabase.from('custom_questions').select('*')
  if (opts.activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q.order('sort_order').order('created_at')
  if (error || !data) return []
  return data as CustomQuestion[]
}

/** Form state for one answer: string for text / single / yes-no ('' | 'yes' | 'no'), string[] for multi. */
export type AnswerDraft = string | string[]
export type AnswerDrafts = Record<string, AnswerDraft>

export const isBlankDraft = (v: AnswerDraft | undefined) => (Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim())

/** Saved answers -> form state. */
export function toDrafts(answers: CustomAnswers | null | undefined): AnswerDrafts {
  const out: AnswerDrafts = {}
  for (const [k, v] of Object.entries(answers ?? {})) out[k] = typeof v === 'boolean' ? (v ? 'yes' : 'no') : v
  return out
}

/** Same checks as validate_custom_answers() in the database. */
export function validateAnswers(questions: CustomQuestion[], drafts: AnswerDrafts, skip: (q: CustomQuestion) => boolean = () => false): string | null {
  for (const q of questions) {
    if (!q.is_active || skip(q)) continue
    const v = drafts[q.id]
    if (isBlankDraft(v)) {
      if (q.is_required) return `Please answer: ${q.label}`
      continue
    }
    if (q.question_type === 'text' && String(v).trim().length > MAX_TEXT_ANSWER) return `Answer to "${q.label}" can have at most ${MAX_TEXT_ANSWER} characters.`
  }
  return null
}

/** Form state -> answers for the database (active questions only; blanks left out). */
export function answersPayload(questions: CustomQuestion[], drafts: AnswerDrafts, includeSensitive: boolean): CustomAnswers {
  const out: CustomAnswers = {}
  for (const q of questions) {
    if (!q.is_active || (q.is_sensitive && !includeSensitive)) continue
    const v = drafts[q.id]
    if (isBlankDraft(v)) continue
    if (q.question_type === 'yes_no') out[q.id] = v === 'yes'
    else if (q.question_type === 'multi_choice') out[q.id] = (v as string[]).filter((x) => q.options.includes(x))
    else out[q.id] = String(v).trim()
  }
  return out
}

/** Answer as text for screens and exports. */
export function formatAnswer(v: CustomAnswers[string] | undefined): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return v
}

/** Questions that are counted on the report page. */
export const isCountable = (q: CustomQuestion) => q.question_type === 'single_choice' || q.question_type === 'yes_no'

/** Possible answers of a countable question, as shown in counts and filters. */
export const answerChoices = (q: CustomQuestion) => (q.question_type === 'yes_no' ? ['Yes', 'No'] : q.options)
