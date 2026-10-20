import Link from 'next/link'
import { BarChart3, ListOrdered } from 'lucide-react'
import { canEdit, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadQuestions } from '@/lib/customQuestions'
import { PageHeader, chipCls } from '@/components/ui'
import SummaryReport from '@/components/SummaryReport'
import ReportBuilder from './ReportBuilder'

export const metadata = { title: 'Reports' }

/**
 * Every role gets the summary report (counts only). Admin and Encoder can switch to the
 * individual list; a Viewer asking for it gets the summary (the database would return no rows anyway).
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await requireRole(['admin', 'encoder', 'viewer'], '/reports')
  const staff = canEdit(session.profile.role)
  const { view } = await searchParams
  const individual = staff && view === 'individual'
  const supabase = await createClient()
  const [{ data: puroks }, questions] = await Promise.all([
    supabase.from('puroks').select('id, name').is('deleted_at', null).order('name'),
    individual ? loadQuestions(supabase, { activeOnly: true }) : Promise.resolve([]),
  ])
  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Reports"
          title={staff ? 'Report generator' : 'Summary reports'}
          subtitle={individual
            ? 'Filter the registry, preview the result, then export to Excel or PDF. Contact numbers and email addresses are never included in exports. Religion, disability and medical information are included only when an Admin chooses to.'
            : 'Counts of active youth by purok, age, sex, education, work and SK questions. No names or contact details. Export to Excel or PDF, or print.'}
        />
        {staff && (
          <div className="mb-6 flex flex-wrap gap-2">
            <Link href="/reports" className={chipCls(!individual)}><BarChart3 className="mr-1.5 h-4 w-4" aria-hidden /> Summary</Link>
            <Link href="/reports?view=individual" className={chipCls(individual)}><ListOrdered className="mr-1.5 h-4 w-4" aria-hidden /> Individual list</Link>
          </div>
        )}
      </div>
      {individual
        ? <ReportBuilder puroks={puroks ?? []} role={session.profile.role} questions={questions} />
        : <SummaryReport puroks={puroks ?? []} />}
    </div>
  )
}
