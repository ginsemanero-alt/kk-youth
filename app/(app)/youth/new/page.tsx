import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Alert, PageHeader } from '@/components/ui'
import YouthForm from '@/components/YouthForm'

export const metadata = { title: 'Add youth' }

export default async function NewYouthPage() {
  await requireRole(['admin', 'encoder'])
  const supabase = await createClient()
  const { data: puroks } = await supabase.from('puroks').select('id, name').is('deleted_at', null).order('name')
  return (
    <div>
      <PageHeader eyebrow="Registry" title="Add youth profile" subtitle="Duplicates (same name and birthdate) are blocked automatically." />
      {(puroks ?? []).length === 0 ? <Alert>Add at least one purok first (Puroks page).</Alert> : <YouthForm mode="create" puroks={puroks ?? []} />}
    </div>
  )
}
