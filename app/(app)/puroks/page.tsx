import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { CountItem, Purok } from '@/lib/types'
import { PageHeader } from '@/components/ui'
import PurokManager from './PurokManager'

export const metadata = { title: 'Puroks' }

export default async function PuroksPage() {
  await requireRole(['admin'], '/puroks')
  const supabase = await createClient()
  const [{ data: puroks }, { data: summary }] = await Promise.all([
    supabase.from('puroks').select('*').is('deleted_at', null).order('name'),
    supabase.rpc('dashboard_summary'),
  ])
  const counts: CountItem[] = (summary as { puroks?: CountItem[] } | null)?.puroks ?? []
  return (
    <div>
      <PageHeader eyebrow="Setup" title="Puroks and sitios" subtitle="Every youth belongs to one purok. A purok with active youth cannot be deleted." />
      <PurokManager puroks={(puroks ?? []) as Purok[]} counts={counts} />
    </div>
  )
}
