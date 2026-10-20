import Link from 'next/link'
import { Activity, ArrowRight, Briefcase, ClipboardCheck, GraduationCap, LifeBuoy, Percent, UserX, Users } from 'lucide-react'
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
        <Link href="/registrations" className="shine group flex animate-rise items-center justify-between gap-4 rounded-[2.5rem] bg-linear-to-r from-sun via-amber-300 to-sun bg-[length:200%_100%] p-6 shadow-lg shadow-sun/30 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:animate-gradient">
          <span className="flex items-center gap-3 text-lg font-black">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-ink text-sun">
              <span className="absolute inset-0 animate-ping rounded-full bg-ink/40" aria-hidden />
              <ClipboardCheck className="relative h-5 w-5" aria-hidden />
            </span>
            {pending.count} self-registration{pending.count === 1 ? '' : 's'} waiting for review
          </span>
          <span className="flex items-center gap-1 rounded-full bg-ink px-4 py-2 text-sm font-black text-white transition group-hover:gap-2">Review <ArrowRight className="h-4 w-4" aria-hidden /></span>
        </Link>
      )}

      {d && d.total === 0 ? (
        <EmptyState icon={Users} title="No youth profiles yet" hint="Add the first profile, import an Excel file, or share the self-registration link." />
      ) : d ? (
        <>
          <div className="stagger grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            <StatCard label="Total youth" value={d.total} tone="bg-ink text-white" icon={Users} sub={`${d.male} male, ${d.female} female`} />
            <StatCard label="In school" value={d.in_school} tone="bg-brand text-white" icon={GraduationCap} sub={pct(d.in_school)} />
            <StatCard label="Out of school" value={d.out_of_school} tone="bg-flag text-white" icon={LifeBuoy} sub={pct(d.out_of_school)} />
            <StatCard label="Employed" value={d.employed} tone="bg-emerald-600 text-white" icon={Briefcase} sub={`${d.unemployed} unemployed`} />
            <StatCard label="Activities held" value={d.activities} tone="bg-grape text-white" icon={Activity} />
            <StatCard label="Avg. participation" value={`${d.avg_participation}%`} tone="bg-sun text-ink" icon={Percent} sub="of all active youth per activity" />
            <StatCard label="Not yet reached" value={d.unreached} tone="bg-amber-500 text-white" icon={UserX} sub="no activity attended" />
            <Link href="/osy" className="shine group relative flex flex-col justify-between overflow-hidden rounded-[2rem] bg-linear-to-br from-flag to-rose-700 p-5 text-white sm:rounded-[2.5rem] sm:p-7 shadow-lg shadow-flag/25 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-flag/40">
              <LifeBuoy className="h-9 w-9 transition duration-500 group-hover:rotate-180" aria-hidden />
              <span className="mt-6 flex items-center justify-between gap-2 text-base font-black sm:text-xl">View OSY referrals <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden /></span>
            </Link>
          </div>
          <DashboardCharts data={d} />
        </>
      ) : null}
    </div>
  )
}
