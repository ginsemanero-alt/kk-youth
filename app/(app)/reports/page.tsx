import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import ReportBuilder from './ReportBuilder'

export const metadata = { title: 'Reports' }

export default async function ReportsPage() {
  await requireRole(['admin', 'encoder', 'viewer'])
  const supabase = await createClient()
  const { data: puroks } = await supabase.from('puroks').select('id, name').is('deleted_at', null).order('name')
  return (
    <div>
      <div className="print:hidden"><PageHeader eyebrow="Reports" title="Report generator" subtitle="Filter the registry, preview the result, then export to Excel or PDF. Contact numbers are never included in exports." /></div>
      <ReportBuilder puroks={puroks ?? []} />
    </div>
  )
}
