import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Clock, Coins, Handshake, MapPin, Pencil, Target, Trophy, Users } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUS, formatTime, label } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import type { ActivityDetail, ActivityPhoto, ActivityStat } from '@/lib/types'
import { Badge, Card, ProgressBarPublic, SectionTitle, btnSun, type Tone } from '@/components/ui'
import AttendanceManager from './AttendanceManager'
import PhotoGallery, { type GalleryPhoto } from './PhotoGallery'

export const metadata = { title: 'Activity' }

const peso = (n: number) => `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Detail({ icon: Icon, k, children }: { icon: typeof Clock; k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[1.75rem] bg-slate-50 p-4 ring-1 ring-black/5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-wider text-slate-400">{k}</div>
        <div className="mt-0.5 break-words font-bold">{children}</div>
      </div>
    </div>
  )
}

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(['admin', 'encoder'], '/activities/[id]')
  const { id } = await params
  const supabase = await createClient()
  const [{ data: row }, { data: stat }, { data: att }, { data: photoRows }] = await Promise.all([
    supabase.from('activities').select('*, puroks(name)').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('activity_stats').select('total_youth').eq('id', id).maybeSingle(),
    supabase.from('attendance').select('youth_id').eq('activity_id', id),
    supabase.from('activity_photos').select('*').eq('activity_id', id).order('created_at'),
  ])
  const a = row as (ActivityDetail & { puroks: { name: string } | null }) | null
  if (!a) notFound()
  const totalYouth = (stat as Pick<ActivityStat, 'total_youth'> | null)?.total_youth ?? 0

  const ids = (att ?? []).map((r) => r.youth_id as string)
  const { data: people } = ids.length
    ? await supabase.from('youth_overview').select('id, full_name, youth_code, purok_name').in('id', ids).is('deleted_at', null)
    : { data: [] as { id: string; full_name: string; youth_code: string; purok_name: string }[] }
  const attendees = (people ?? [])
    .map((r) => ({ id: r.id, name: r.full_name, code: r.youth_code, purok: r.purok_name }))
    .sort((x, y) => x.name.localeCompare(y.name))

  // Signed links to the private photos, valid for one hour.
  const photos = (photoRows ?? []) as ActivityPhoto[]
  const { data: signed } = photos.length
    ? await supabase.storage.from('activity-photos').createSignedUrls(photos.map((p) => p.path), 3600)
    : { data: [] }
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
  const gallery: GalleryPhoto[] = photos.map((p) => ({ ...p, url: urlOf.get(p.path) ?? null }))

  const status = ACTIVITY_STATUS.find((s) => s.value === a.status) ?? ACTIVITY_STATUS[0]
  const time = [formatTime(a.start_time), formatTime(a.end_time)].filter(Boolean).join(' to ')
  const rate = totalYouth ? Math.round((attendees.length / totalYouth) * 1000) / 10 : 0
  const cover = gallery.find((p) => p.url)?.url

  return (
    <div className="space-y-6">
      <Link href="/activities" className="inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Activities</Link>

      <Card className="relative isolate overflow-hidden !bg-ink !text-white">
        {cover && <img src={cover} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30" />}
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-ink via-ink/90 to-ink/40" aria-hidden />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status.tone as Tone}>{status.label}</Badge>
              <Badge tone="sun">{label(ACTIVITY_CATEGORIES, a.category)}</Badge>
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{a.title}</h1>
            <p className="mt-2 font-semibold text-white/70">
              {formatDate(a.activity_date)}{time ? `, ${time}` : ''}{a.venue ? ` / ${a.venue}` : ''}
            </p>
            {a.description && <p className="mt-3 max-w-2xl font-semibold text-white/80">{a.description}</p>}
          </div>
          <Link href={`/activities/${a.id}/edit`} className={btnSun}><Pencil className="h-4 w-4" /> Edit details</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex justify-between text-sm font-black"><span className="text-white/60">Participation</span><span>{attendees.length} of {totalYouth} youth ({rate}%)</span></div>
            <ProgressBarPublic value={rate} tone="bg-sun" />
          </div>
          {a.target_participants && (
            <div>
              <div className="mb-2 flex justify-between text-sm font-black"><span className="text-white/60">Target</span><span>{attendees.length} of {a.target_participants}</span></div>
              <ProgressBarPublic value={(attendees.length / a.target_participants) * 100} tone="bg-emerald-400" />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>Details</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail icon={CalendarDays} k="Date">{formatDate(a.activity_date)}</Detail>
          <Detail icon={Clock} k="Time">{time || <span className="text-slate-300">Not set</span>}</Detail>
          <Detail icon={MapPin} k="Venue">{a.venue || 'Not set'}{a.puroks?.name ? ` (${a.puroks.name})` : ' (whole barangay)'}</Detail>
          <Detail icon={Users} k="Organizer">{a.organizer || <span className="text-slate-300">Not set</span>}</Detail>
          <Detail icon={Target} k="Target participants">{a.target_participants ?? <span className="text-slate-300">Not set</span>}</Detail>
          <Detail icon={Coins} k="Budget">{a.budget !== null ? `${peso(Number(a.budget))}${a.fund_source ? ` (${a.fund_source})` : ''}` : <span className="text-slate-300">Not set</span>}</Detail>
          {a.partners && <Detail icon={Handshake} k="Partners">{a.partners}</Detail>}
        </div>
        {(a.objectives || a.outcome) && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {a.objectives && (
              <div className="rounded-[2rem] bg-brand-soft/60 p-6">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-brand-deep"><Target className="h-4 w-4" aria-hidden /> Objectives</div>
                <p className="mt-2 whitespace-pre-line font-semibold text-slate-700">{a.objectives}</p>
              </div>
            )}
            {a.outcome && (
              <div className="rounded-[2rem] bg-emerald-50 p-6">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-emerald-800"><Trophy className="h-4 w-4" aria-hidden /> Outcome</div>
                <p className="mt-2 whitespace-pre-line font-semibold text-slate-700">{a.outcome}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      <PhotoGallery activityId={a.id} initial={gallery} meId={session.userId} isAdmin={session.profile.role === 'admin'} />
      <AttendanceManager activityId={a.id} initial={attendees} canEdit />
    </div>
  )
}
