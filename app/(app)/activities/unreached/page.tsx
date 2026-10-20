import Link from 'next/link'
import { ArrowLeft, PartyPopper } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { EDU_LEVEL_OPTIONS, label } from '@/lib/constants'
import type { YouthOverview } from '@/lib/types'
import { EducationBadge, EmploymentBadge, EmptyState, PageHeader, chipCls } from '@/components/ui'
import ExportButtons from '@/components/ExportButtons'

export const metadata = { title: 'Youth not yet reached' }

const WINDOWS = [
  { key: 'all', label: 'Ever', months: 0 },
  { key: '6', label: 'Last 6 months', months: 6 },
  { key: '12', label: 'Last 12 months', months: 12 },
]

export default async function UnreachedPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  await requireRole(['admin', 'encoder'], '/activities/unreached')
  const { w } = await searchParams
  const win = WINDOWS.find((x) => x.key === w) ?? WINDOWS[0]
  let since: string | null = null
  if (win.months) {
    const d = new Date()
    d.setMonth(d.getMonth() - win.months)
    since = d.toISOString().slice(0, 10)
  }
  const supabase = await createClient()
  const { data } = await supabase.rpc('unreached_youth', { p_since: since })
  const rows = (data ?? []) as YouthOverview[]

  const exportRows = rows.map((r) => ({
    'Youth ID': r.youth_code, Name: r.full_name, Age: r.age, Purok: r.purok_name,
    Education: r.education_status.replace('_', ' '), 'Last level': label(EDU_LEVEL_OPTIONS, r.education_level),
  }))
  const columns = ['Youth ID', 'Name', 'Age', 'Purok', 'Education', 'Last level'].map((k) => ({ header: k, key: k }))

  return (
    <div className="space-y-6">
      <Link href="/activities" className="inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Activities</Link>
      <PageHeader
        eyebrow="Outreach" title="Not yet reached"
        subtitle={`${rows.length} youth with no recorded attendance${win.months ? ` in the ${win.label.toLowerCase()}` : ''}. Invite them to the next activity.`}
        right={<ExportButtons rows={exportRows} columns={columns} title="Youth not yet reached" subtitle={win.label} filename="not-reached" source="youth_overview" filters={{ window: win.key }} />}
      />
      <div className="flex flex-wrap gap-2">
        {WINDOWS.map((x) => <Link key={x.key} href={x.key === 'all' ? '/activities/unreached' : `/activities/unreached?w=${x.key}`} className={chipCls(x.key === win.key)}>{x.label}</Link>)}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={PartyPopper} title="Everyone has been reached" hint="Every active youth has attended at least one activity in this period." />
      ) : (
        <div className="overflow-x-auto rounded-[3rem] bg-white shadow-sm ring-1 ring-black/5">
          <table className="w-full min-w-[640px] text-left">
            <thead><tr className="border-b border-slate-100 text-xs font-black uppercase tracking-widest text-slate-400">
              <th className="px-8 py-5">Name</th><th className="px-4 py-5">Age</th><th className="px-4 py-5">Purok</th><th className="px-4 py-5">Education</th><th className="px-8 py-5">Employment</th></tr></thead>
            <tbody>
              {rows.map((y) => (
                <tr key={y.id} className="border-b border-slate-50 last:border-0 hover:bg-brand-soft/40">
                  <td className="px-8 py-4"><Link href={`/youth/${y.id}`} className="font-black hover:text-brand">{y.last_name}, {y.first_name}</Link></td>
                  <td className="px-4 py-4 font-bold">{y.age}</td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{y.purok_name}</td>
                  <td className="px-4 py-4"><EducationBadge status={y.education_status} /></td>
                  <td className="px-8 py-4"><EmploymentBadge status={y.employment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
