import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadQuestions } from '@/lib/customQuestions'
import type { FormFieldSetting } from '@/lib/types'
import { Alert, PageHeader } from '@/components/ui'
import FormSettingsManager from './FormSettingsManager'

export const metadata = { title: 'Form settings' }
export const dynamic = 'force-dynamic'

export default async function FormSettingsPage() {
  await requireRole(['admin'], '/admin/form-settings')
  const supabase = await createClient()
  const [{ data, error }, { data: puroks }, questions] = await Promise.all([
    supabase.from('form_fields').select('*').order('sort_order'),
    supabase.from('puroks').select('id, name').is('deleted_at', null).order('name'),
    loadQuestions(supabase),
  ])
  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Form settings"
        subtitle="Choose which details the self-registration form, the encoder form and the Excel import ask for. Name, birthdate, sex, purok and educational status are always asked. Changes do not alter records that are already saved."
      />
      {error || !data?.length ? (
        <Alert>Form settings are not set up yet. Run supabase/04_form_fields_extra.sql, 05_form_settings.sql and 06_custom_questions.sql in the Supabase SQL Editor.</Alert>
      ) : (
        <FormSettingsManager initial={data as FormFieldSetting[]} initialQuestions={questions} puroks={puroks ?? []} />
      )}
    </div>
  )
}
