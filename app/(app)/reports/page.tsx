import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import ReportBuilder from './ReportBuilder'

export const metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const session = await requireRole(['admin', 'encoder', 'viewer'])
  const supabase = await createClient()
  const { data: puroks } = await supabase.from('puroks').select('id, name').is('deleted_at', null).order('name')
  return (
    <div>
      <div className="print:hidden"><PageHeader eyebrow="Reports" title="Report generator" subtitle="Filter the registry, preview the result, then export to Excel or PDF. Contact numbers and email addresses are never included in exports. Religion, disability and medical information are included only when an Admin chooses to." /></div>
      <ReportBuilder puroks={puroks ?? []} role={session.profile.role} />
    </div>
  )
}
