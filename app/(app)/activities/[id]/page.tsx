import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { canEdit, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ACTIVITY_CATEGORIES, label } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import type { ActivityStat } from '@/lib/types'
import { Badge, Card, ProgressBarPublic } from '@/components/ui'
import AttendanceManager from './AttendanceManager'

export const metadata = { title: 'Activity' }

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(['admin', 'encoder', 'viewer'])
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('activity_stats').select('*').eq('id', id).maybeSingle()
  const a = data as ActivityStat | null
  if (!a) notFound()

  const { data: att } = await supabase.from('attendance').select('youth_id').eq('activity_id', id)
  const ids = (att ?? []).map((r) => r.youth_id as string)
  const { data: people } = ids.length
    ? await supabase.from('youth_overview').select('id, full_name, youth_code, purok_name').in('id', ids).is('deleted_at', null)
    : { data: [] as { id: string; full_name: string; youth_code: string; purok_name: string }[] }
  const attendees = (people ?? [])
    .map((r) => ({ id: r.id, name: r.full_name, code: r.youth_code, purok: r.purok_name }))
    .sort((x, y) => x.name.localeCompare(y.name))

  return (
    <div className="space-y-6">
      <Link href="/activities" className="inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Activities</Link>
      <Card className="!bg-ink !text-white">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="sun">{label(ACTIVITY_CATEGORIES, a.category)}</Badge>
          <span className="text-sm font-bold text-white/60">{formatDate(a.activity_date)}{a.venue ? ` / ${a.venue}` : ''}</span>
        </div>
        <h1 className="mt-3 text-4xl font-black tracking-tight">{a.title}</h1>
        {a.description && <p className="mt-2 max-w-2xl font-semibold text-white/70">{a.description}</p>}
        <div className="mt-6 max-w-md">
          <div className="mb-2 flex justify-between text-sm font-black"><span className="text-white/60">Participation</span><span>{attendees.length} of {a.total_youth} ({a.total_youth ? Math.round((attendees.length / a.total_youth) * 1000) / 10 : 0}%)</span></div>
          <ProgressBarPublic value={a.total_youth ? (attendees.length / a.total_youth) * 100 : 0} tone="bg-sun" />
        </div>
      </Card>
      <AttendanceManager activityId={a.id} initial={attendees} canEdit={canEdit(session.profile.role)} />
    </div>
  )
}
