import { Activity, LifeBuoy, Percent, Users } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ACTIVITY_CATEGORIES, label } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { groupLabel, type GroupKey, type SummaryReport } from '@/lib/summary'
import type { ActivityStat } from '@/lib/types'
import CountBars from '@/components/CountBars'
import { Alert, Card, PageHeader, SectionTitle, StatCard } from '@/components/ui'

export const metadata = { title: 'Youth statistics' }
export const dynamic = 'force-dynamic'

/** Aggregate statistics for every role (no names): out-of-school youth and activity participation. */
export default async function StatisticsPage() {
  await requireRole(['admin', 'encoder', 'viewer'], '/statistics')
  const supabase = await createClient()
  const [{ data, error }, { data: acts }] = await Promise.all([
    supabase.rpc('summary_report'),
    supabase.from('activity_stats').select('*').order('activity_date', { ascending: false }).limit(50),
  ])
  const s = data as SummaryReport | null
  const activities = (acts ?? []) as ActivityStat[]
  const items = (key: GroupKey) => (s?.groups[key] ?? []).map((x) => ({ label: groupLabel(key, x.label), count: x.count }))
  const avg = activities.length ? Math.round((activities.reduce((a, x) => a + Number(x.participation_rate), 0) / activities.length) * 10) / 10 : 0

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Statistics" title="Youth statistics" subtitle="Aggregate figures for planning. No names or contact details are shown on this page." />
      {error && <Alert>{error.message}</Alert>}
      {s?.masked && <Alert tone="info">Counts of 1 or 2 are shown as &quot;&lt;3&quot; so that no single youth can be identified.</Alert>}

      {s && (
        <>
          <div className="stagger grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            <StatCard label="Active youth" value={s.total} tone="bg-ink text-white" icon={Users} />
            <StatCard label="Out of school" value={s.osy} tone="bg-flag text-white" icon={LifeBuoy} />
            <StatCard label="Activities" value={activities.length} tone="bg-grape text-white" icon={Activity} />
            <StatCard label="Avg. participation" value={`${avg}%`} tone="bg-sun text-ink" icon={Percent} sub="per activity" />
          </div>

          <section>
            <SectionTitle sub="Youth marked out of school, grouped without names">Out-of-school youth</SectionTitle>
            <div className="grid gap-5 md:grid-cols-3">
              <CountBars title="By purok" tone="bg-flag" items={items('osy_by_purok')} empty="No out-of-school youth" />
              <CountBars title="By last level" tone="bg-sun" items={items('osy_by_level')} empty="No out-of-school youth" />
              <CountBars title="By work status" tone="bg-grape" items={items('osy_by_employment')} empty="No out-of-school youth" />
            </div>
          </section>

          <section>
            <SectionTitle>Population</SectionTitle>
            <div className="grid gap-5 md:grid-cols-3">
              <CountBars title="By purok" items={items('purok')} />
              <CountBars title="By age group" tone="bg-sun" items={items('age_bracket')} />
              <CountBars title="By educational status" tone="bg-emerald-600" items={items('education_status')} />
            </div>
          </section>
        </>
      )}

      <Card>
        <SectionTitle sub="Attendance counts and participation rate per activity (latest 50)">Activity participation</SectionTitle>
        {activities.length === 0 ? (
          <p className="font-semibold text-slate-500">No activities recorded yet.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead><tr className="border-b border-slate-100 text-xs font-black uppercase tracking-widest text-slate-400">
                <th className="px-2 py-3">Activity</th><th className="px-2 py-3">Date</th><th className="px-2 py-3">Attended</th><th className="px-2 py-3">Participation</th></tr></thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-2 py-3"><div className="font-black">{a.title}</div><div className="text-xs font-bold text-slate-400">{label(ACTIVITY_CATEGORIES, a.category)}</div></td>
                    <td className="px-2 py-3 text-sm font-semibold text-slate-600">{formatDate(a.activity_date)}</td>
                    <td className="px-2 py-3 font-black">{a.attendees}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Number(a.participation_rate))}%` }} /></div>
                        <span className="text-sm font-black">{a.participation_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
