import Link from 'next/link'
import { Activity, Briefcase, ClipboardCheck, GraduationCap, LifeBuoy, UserX, Users } from 'lucide-react'
import { requireRole, canEdit } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { DashboardSummary } from '@/lib/types'
import { Alert, EmptyState, PageHeader, StatCard } from '@/components/ui'
import DashboardCharts from './DashboardChartsLazy'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const session = await requireRole(['admin', 'encoder', 'viewer'])
  const { denied } = await searchParams
  const supabase = await createClient()
  const [{ data, error }, pending] = await Promise.all([
    supabase.rpc('dashboard_summary'),
    canEdit(session.profile.role)
      ? supabase.from('pending_registrations').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
  ])
  const d = data as DashboardSummary | null
  const pct = (n: number) => (d && d.total ? `${Math.round((n / d.total) * 100)}%` : '0%')

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Overview" title="Dashboard" subtitle="Computed live in the database from active youth profiles." />
      {denied && <Alert>You do not have access to that page.</Alert>}
      {error && <Alert>{error.message}</Alert>}

      {(pending.count ?? 0) > 0 && (
        <Link href="/registrations" className="flex items-center justify-between gap-4 rounded-[2.5rem] bg-sun p-6 shadow-sm ring-1 ring-black/5 transition hover:brightness-95">
          <span className="flex items-center gap-3 text-lg font-black"><ClipboardCheck className="h-6 w-6" aria-hidden /> {pending.count} self-registration{pending.count === 1 ? '' : 's'} waiting for review</span>
          <span className="font-black underline">Review</span>
        </Link>
      )}

      {d && d.total === 0 ? (
        <EmptyState icon={Users} title="No youth profiles yet" hint="Add the first profile, import an Excel file, or share the self-registration link." />
      ) : d ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total youth" value={d.total} tone="bg-ink text-white" icon={Users} sub={`${d.male} male, ${d.female} female`} />
            <StatCard label="In school" value={d.in_school} tone="bg-brand text-white" icon={GraduationCap} sub={pct(d.in_school)} />
            <StatCard label="Out of school" value={d.out_of_school} tone="bg-flag text-white" icon={LifeBuoy} sub={pct(d.out_of_school)} />
            <StatCard label="Employed" value={d.employed} tone="bg-emerald-600 text-white" icon={Briefcase} sub={`${d.unemployed} unemployed`} />
            <StatCard label="Activities held" value={d.activities} icon={Activity} />
            <StatCard label="Avg. participation" value={`${d.avg_participation}%`} tone="bg-sun text-ink" icon={Activity} sub="of all active youth per activity" />
            <StatCard label="Not yet reached" value={d.unreached} icon={UserX} sub="no activity attended" />
            <Link href="/osy" className="flex items-center justify-between rounded-[3.5rem] bg-white p-8 text-lg font-black shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl">
              View OSY referrals <LifeBuoy className="h-6 w-6 text-flag" aria-hidden />
            </Link>
          </div>
          <DashboardCharts data={d} />
        </>
      ) : null}
    </div>
  )
}
