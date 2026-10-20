import Link from 'next/link'
import { LifeBuoy } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/errors'
import { EDU_LEVEL_OPTIONS, EMPLOYMENT_OPTIONS, label } from '@/lib/constants'
import type { YouthOverview } from '@/lib/types'
import { Card, EmploymentBadge, EmptyState, PageHeader, Pill, StatCard, btnDark, inputCls } from '@/components/ui'
import ExportButtons from '@/components/ExportButtons'

export const metadata = { title: 'Out-of-school youth' }

export default async function OsyPage({ searchParams }: { searchParams: Promise<{ purok?: string; emp?: string }> }) {
  await requireRole(['admin', 'encoder'], '/osy')
  const sp = await searchParams
  const supabase = await createClient()
  const { data: puroks } = await supabase.from('puroks').select('id, name').is('deleted_at', null).order('name')

  let query = supabase.from('youth_overview').select('*').eq('is_osy', true).is('deleted_at', null)
  if (sp.purok) query = query.eq('purok_id', sp.purok)
  if (sp.emp) query = query.eq('employment_status', sp.emp)
  const { data, error } = await query.order('last_name').limit(2000)
  if (error) throw new Error(friendlyError(error))
  const rows = (data ?? []) as YouthOverview[]
  const unemployed = rows.filter((r) => r.employment_status === 'unemployed').length

  const exportRows = rows.map((r) => ({
    'Youth ID': r.youth_code, Name: r.full_name, Age: r.age, Purok: r.purok_name,
    'Last level': label(EDU_LEVEL_OPTIONS, r.education_level) || 'Not specified',
    Employment: label(EMPLOYMENT_OPTIONS, r.employment_status), 'Suggested referrals': r.referrals.join('; '),
  }))
  const columns = ['Youth ID', 'Name', 'Age', 'Purok', 'Last level', 'Employment', 'Suggested referrals'].map((k) => ({ header: k, key: k }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Out-of-school youth"
        title="OSY and referrals"
        subtitle="Youth marked out of school, with suggested programs. Suggestions are informational; the SK confirms eligibility."
        right={<ExportButtons rows={exportRows} columns={columns} title="Out-of-school youth" subtitle={`Generated ${new Date().toLocaleDateString('en-PH')}`} filename="osy" source="youth_overview" filters={sp} />}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <StatCard label="OSY in this view" value={rows.length} tone="bg-flag text-white" icon={LifeBuoy} />
        <StatCard label="Also unemployed" value={unemployed} tone="bg-sun text-ink" sub="Priority for TESDA and job programs" />
      </div>

      <form method="get" className="grid gap-3 rounded-[3rem] bg-white p-5 shadow-sm ring-1 ring-black/5 sm:grid-cols-3">
        <select name="purok" defaultValue={sp.purok ?? ''} aria-label="Purok" className={inputCls}>
          <option value="">All puroks</option>
          {(puroks ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="emp" defaultValue={sp.emp ?? ''} aria-label="Employment" className={inputCls}>
          <option value="">All employment</option>
          {EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" className={btnDark}>Apply filters</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No out-of-school youth in this view" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} className="!p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/youth/${r.id}`} className="text-xl font-black hover:text-brand">{r.full_name}</Link>
                  <p className="text-sm font-semibold text-slate-500">{r.age} yrs / {r.purok_name} / {label(EDU_LEVEL_OPTIONS, r.education_level) || 'level not specified'}</p>
                </div>
                <EmploymentBadge status={r.employment_status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {r.referrals.length ? r.referrals.map((x) => <Pill key={x}>{x}</Pill>) : <span className="text-sm font-semibold text-slate-400">No suggestion</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
