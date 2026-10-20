import Link from 'next/link'
import { Activity, ArrowRight, Briefcase, ClipboardCheck, GraduationCap, History, LifeBuoy, Percent, PieChart, UserX, Users } from 'lucide-react'
import { requireRole, canEdit } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/format'
import type { AuditLog, DashboardSummary } from '@/lib/types'
import { Alert, Badge, Card, EmptyState, PageHeader, SectionTitle, StatCard, type Tone } from '@/components/ui'
import DashboardCharts from './DashboardChartsLazy'

export const metadata = { title: 'Dashboard' }

const TONE: Record<string, Tone> = { insert: 'green', update: 'blue', delete: 'red', restore: 'teal', view: 'amber', export: 'violet', approve: 'green', reject: 'rose', purge: 'ink', denied: 'red' }

/**
 * Every role sees the aggregate dashboard (dashboard_summary() returns counts only). Admin and Encoder
 * also see pending registrations and recently updated profiles; the Admin also sees recent system activity.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const session = await requireRole(['admin', 'encoder', 'viewer'], '/dashboard')
  const role = session.profile.role
  const staff = canEdit(role)
  const { denied } = await searchParams
  const supabase = await createClient()
  const [{ data, error }, pending, recentYouth, recentLog] = await Promise.all([
    supabase.rpc('dashboard_summary'),
    staff
      ? supabase.from('pending_registrations').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    staff
      ? supabase.from('youth_overview').select('id, full_name, youth_code, purok_name, updated_at').is('deleted_at', null).order('updated_at', { ascending: false }).limit(6)
      : Promise.resolve({ data: [] }),
    role === 'admin'
      ? supabase.from('audit_logs').select('id, actor_name, action, table_name, created_at').order('id', { ascending: false }).limit(6)
      : Promise.resolve({ data: [] }),
  ])
  const d = data as DashboardSummary | null
  const pct = (n: number) => (d && d.total ? `${Math.round((n / d.total) * 100)}%` : '0%')
  const updated = (recentYouth.data ?? []) as { id: string; full_name: string; youth_code: string; purok_name: string; updated_at: string }[]
  const logs = (recentLog.data ?? []) as Pick<AuditLog, 'id' | 'actor_name' | 'action' | 'table_name' | 'created_at'>[]

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Overview" title="Dashboard" subtitle={staff ? 'Computed live in the database from active youth profiles.' : 'Aggregate statistics of active youth profiles. No names or contact details.'} />
      {denied && <Alert>You do not have access to that page. The attempt was recorded.</Alert>}
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
        <EmptyState icon={Users} title="No youth profiles yet" hint={staff ? 'Add the first profile, import an Excel file, or share the self-registration link.' : 'Statistics appear here once the SK has added youth profiles.'} />
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
            <Link href={staff ? '/osy' : '/statistics'} className="shine group relative flex flex-col justify-between overflow-hidden rounded-[2rem] bg-linear-to-br from-flag to-rose-700 p-5 text-white sm:rounded-[2.5rem] sm:p-7 shadow-lg shadow-flag/25 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-flag/40">
              {staff ? <LifeBuoy className="h-9 w-9 transition duration-500 group-hover:rotate-180" aria-hidden /> : <PieChart className="h-9 w-9 transition duration-500 group-hover:rotate-180" aria-hidden />}
              <span className="mt-6 flex items-center justify-between gap-2 text-base font-black sm:text-xl">
                {staff ? 'View OSY referrals' : 'Youth statistics'} <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          </div>
          <DashboardCharts data={d} />
        </>
      ) : null}

      {(staff || logs.length > 0) && (
        <div className={`grid gap-6 ${role === 'admin' ? 'lg:grid-cols-2' : ''}`}>
          {staff && (
            <Card>
              <SectionTitle sub="Last profiles added or edited">Recently updated profiles</SectionTitle>
              {updated.length === 0 ? <p className="font-semibold text-slate-500">No profiles yet.</p> : (
                <ul className="divide-y divide-slate-100">
                  {updated.map((y) => (
                    <li key={y.id}>
                      <Link href={`/youth/${y.id}`} className="group flex items-center justify-between gap-3 py-3">
                        <span className="min-w-0">
                          <span className="block truncate font-black group-hover:text-brand">{y.full_name}</span>
                          <span className="block text-xs font-bold text-slate-400">{y.youth_code} / {y.purok_name}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-slate-400">{formatDateTime(y.updated_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {role === 'admin' && (
            <Card>
              <SectionTitle sub="Latest entries in the audit log">
                <span className="inline-flex items-center gap-2"><History className="h-6 w-6 text-brand" aria-hidden /> Recent activity</span>
              </SectionTitle>
              {logs.length === 0 ? <p className="font-semibold text-slate-500">No activity yet.</p> : (
                <ul className="space-y-2">
                  {logs.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[1.5rem] bg-slate-50 px-4 py-3 ring-1 ring-black/5">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                        <Badge tone={TONE[l.action] ?? 'slate'}>{l.action}</Badge>
                        <span className="truncate">{l.actor_name ?? 'system'} / {l.table_name}</span>
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{formatDateTime(l.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/admin/audit" className="mt-4 inline-flex items-center gap-1 text-sm font-black text-brand hover:underline">Open audit logs <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
