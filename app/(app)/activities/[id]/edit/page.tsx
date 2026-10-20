import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { ActivityDetail } from '@/lib/types'
import { PageHeader } from '@/components/ui'
import ActivityForm from '../../ActivityForm'

export const metadata = { title: 'Edit activity' }

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin', 'encoder'], '/activities/[id]/edit')
  const { id } = await params
  const supabase = await createClient()
  const [{ data }, { data: puroks }] = await Promise.all([
    supabase.from('activities').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('puroks').select('id, name').is('deleted_at', null).order('name'),
  ])
  const a = data as ActivityDetail | null
  if (!a) notFound()
  return (
    <div>
      <PageHeader eyebrow="Programs" title={`Edit ${a.title}`} />
      <ActivityForm initial={a} puroks={puroks ?? []} />
    </div>
  )
}
