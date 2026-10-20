import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import ActivityForm from '../ActivityForm'

export const metadata = { title: 'New activity' }

export default async function NewActivityPage() {
  await requireRole(['admin', 'encoder'], '/activities/new')
  const supabase = await createClient()
  const { data: puroks } = await supabase.from('puroks').select('id, name').is('deleted_at', null).order('name')
  return (
    <div>
      <PageHeader eyebrow="Programs" title="New SK activity" subtitle="Record the plan now; add photos, attendance and the outcome later." />
      <ActivityForm puroks={puroks ?? []} />
    </div>
  )
}
