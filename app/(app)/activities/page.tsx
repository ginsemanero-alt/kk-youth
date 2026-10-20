import Link from 'next/link'
import { Activity as ActivityIcon, ArrowRight, UserX } from 'lucide-react'
import { canEdit, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ACTIVITY_CATEGORIES, label } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import type { ActivityStat } from '@/lib/types'
import { Badge, EmptyState, PageHeader, ProgressBarPublic, btnGhost } from '@/components/ui'
import NewActivity from './NewActivity'

export const metadata = { title: 'Activities' }

export default async function ActivitiesPage() {
  const session = await requireRole(['admin', 'encoder'], '/activities')
  const supabase = await createClient()
  const { data } = await supabase.from('activity_stats').select('*').order('activity_date', { ascending: false }).limit(200)
  const rows = (data ?? []) as ActivityStat[]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Programs"
        title="SK activities"
        subtitle="Record events, mark who attended, and see participation rates."
        right={<>
          <Link href="/activities/unreached" className={btnGhost}><UserX className="h-4 w-4" /> Not yet reached</Link>
          {canEdit(session.profile.role) && <NewActivity />}
        </>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="No activities yet" hint="Create the first SK activity, then record attendance." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {rows.map((a) => (
            <Link key={a.id} href={`/activities/${a.id}`} className="group rounded-[3.5rem] bg-white p-8 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">{label(ACTIVITY_CATEGORIES, a.category)}</Badge>
                <span className="text-sm font-bold text-slate-400">{formatDate(a.activity_date)}</span>
              </div>
              <h2 className="mt-3 text-2xl font-black leading-tight">{a.title}</h2>
              {a.venue && <p className="text-sm font-semibold text-slate-500">{a.venue}</p>}
              <div className="mt-5">
                <div className="mb-2 flex items-baseline justify-between text-sm font-black">
                  <span className="text-slate-500">Participation</span>
                  <span>{a.attendees} of {a.total_youth} ({a.participation_rate}%)</span>
                </div>
                <ProgressBarPublic value={a.participation_rate} />
              </div>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-brand">Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
