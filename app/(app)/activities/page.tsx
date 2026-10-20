import Link from 'next/link'
import { Activity as ActivityIcon, ArrowRight, Camera, Clock, MapPin, Plus, UserX } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUS, formatTime, label } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import type { ActivityStat, ActivityStatus } from '@/lib/types'
import { Badge, EmptyState, PageHeader, ProgressBarPublic, btnGhost, btnPrimary, type Tone } from '@/components/ui'

export const metadata = { title: 'Activities' }

export default async function ActivitiesPage() {
  await requireRole(['admin', 'encoder'], '/activities')
  const supabase = await createClient()
  const [{ data }, { data: details }, { data: photoRows }] = await Promise.all([
    supabase.from('activity_stats').select('*').order('activity_date', { ascending: false }).limit(200),
    supabase.from('activities').select('id, status, start_time, end_time').is('deleted_at', null),
    supabase.from('activity_photos').select('activity_id, path').order('created_at'),
  ])
  const rows = (data ?? []) as ActivityStat[]
  const extra = new Map((details ?? []).map((d) => [d.id as string, d as { status: ActivityStatus; start_time: string | null; end_time: string | null }]))

  // First photo of each activity as its cover, plus photo counts (one signed-URL call for all covers).
  const counts = new Map<string, number>()
  const firstPath = new Map<string, string>()
  for (const p of photoRows ?? []) {
    counts.set(p.activity_id, (counts.get(p.activity_id) ?? 0) + 1)
    if (!firstPath.has(p.activity_id)) firstPath.set(p.activity_id, p.path)
  }
  const { data: signed } = firstPath.size
    ? await supabase.storage.from('activity-photos').createSignedUrls([...firstPath.values()], 3600)
    : { data: [] }
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Programs"
        title="SK activities"
        subtitle="Plan events, add photos, mark who attended, and record the outcome."
        right={<>
          <Link href="/activities/unreached" className={btnGhost}><UserX className="h-4 w-4" /> Not yet reached</Link>
          <Link href="/activities/new" className={btnPrimary}><Plus className="h-4 w-4" /> New activity</Link>
        </>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="No activities yet" hint="Create the first SK activity, then add photos and attendance." action={<Link href="/activities/new" className={btnPrimary}><Plus className="h-4 w-4" /> New activity</Link>} />
      ) : (
        <div className="stagger grid gap-5 md:grid-cols-2">
          {rows.map((a) => {
            const x = extra.get(a.id)
            const status = ACTIVITY_STATUS.find((s) => s.value === x?.status) ?? ACTIVITY_STATUS[0]
            const cover = firstPath.has(a.id) ? urlOf.get(firstPath.get(a.id)!) : null
            const time = [formatTime(x?.start_time), formatTime(x?.end_time)].filter(Boolean).join(' to ')
            return (
              <Link key={a.id} href={`/activities/${a.id}`} className="group overflow-hidden rounded-[2.5rem] bg-white shadow-[0_1px_2px_rgb(11_18_56/0.04),0_12px_32px_-12px_rgb(11_18_56/0.12)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-40 overflow-hidden bg-linear-to-br from-ink via-brand-deep to-brand">
                  {cover
                    ? <img src={cover} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
                    : <ActivityIcon className="absolute bottom-4 right-5 h-16 w-16 text-white/15" aria-hidden />}
                  <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
                    <Badge tone={status.tone as Tone}>{status.label}</Badge>
                    <Badge tone="sun">{label(ACTIVITY_CATEGORIES, a.category)}</Badge>
                  </div>
                  {counts.get(a.id) ? (
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-ink/70 px-3 py-1 text-xs font-black text-white backdrop-blur"><Camera className="h-3.5 w-3.5" aria-hidden /> {counts.get(a.id)}</span>
                  ) : null}
                </div>
                <div className="p-6 sm:p-7">
                  <span className="text-sm font-bold text-slate-400">{formatDate(a.activity_date)}</span>
                  <h2 className="mt-1 text-2xl font-black leading-tight group-hover:text-brand">{a.title}</h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-slate-500">
                    {time && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden /> {time}</span>}
                    {a.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden /> {a.venue}</span>}
                  </div>
                  <div className="mt-5">
                    <div className="mb-2 flex items-baseline justify-between text-sm font-black">
                      <span className="text-slate-500">Participation</span>
                      <span>{a.attendees} of {a.total_youth} ({a.participation_rate}%)</span>
                    </div>
                    <ProgressBarPublic value={a.participation_rate} />
                  </div>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-brand">Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
