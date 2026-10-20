import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadFormSettings } from '@/lib/formSettings'
import { loadQuestions } from '@/lib/customQuestions'
import { PageHeader } from '@/components/ui'
import ImportWizard from './ImportWizard'

export const metadata = { title: 'Excel import' }

export default async function ImportPage() {
  await requireRole(['admin', 'encoder'])
  const supabase = await createClient()
  const [{ data: puroks }, settings, questions] = await Promise.all([
    supabase.from('puroks').select('id, name').is('deleted_at', null).order('name'),
    loadFormSettings(supabase),
    loadQuestions(supabase, { activeOnly: true }),
  ])
  return (
    <div>
      <PageHeader eyebrow="Migration" title="Excel import" subtitle="Bring existing records into the registry. Rows are validated first, and you get a downloadable error report." />
      <ImportWizard puroks={(puroks ?? []).map((p) => p.name)} settings={settings} questions={questions} />
    </div>
  )
}
