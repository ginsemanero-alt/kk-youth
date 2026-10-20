'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, Loader2, Plus, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { likeSafe } from '@/lib/format'
import { Alert, Card, SectionTitle, inputCls } from '@/components/ui'

interface Person { id: string; name: string; code: string; purok: string }

export default function AttendanceManager({ activityId, initial, canEdit }: { activityId: string; initial: Person[]; canEdit: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [attendees, setAttendees] = useState<Person[]>(initial)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setAttendees(initial), [initial])

  useEffect(() => {
    const term = likeSafe(q)
    if (term.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data, error: err } = await createClient()
        .from('youth_overview').select('id, full_name, youth_code, purok_name')
        .is('deleted_at', null)
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,youth_code.ilike.%${term}%`)
        .order('last_name').limit(12)
      setSearching(false)
      if (err) return setError(friendlyError(err))
      setResults((data ?? []).map((r) => ({ id: r.id, name: r.full_name, code: r.youth_code, purok: r.purok_name })))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const present = (id: string) => attendees.some((a) => a.id === id)

  const mark = async (p: Person) => {
    setError(null); setBusyId(p.id)
    const { error: err } = await createClient().from('attendance').insert({ activity_id: activityId, youth_id: p.id })
    setBusyId(null)
    if (err && err.code !== '23505') { const m = friendlyError(err); setError(m); return toast.error(m) }
    setAttendees((a) => (a.some((x) => x.id === p.id) ? a : [...a, p].sort((x, y) => x.name.localeCompare(y.name))))
    router.refresh()
  }

  const unmark = async (p: Person) => {
    setError(null); setBusyId(p.id)
    const { error: err } = await createClient().from('attendance').delete().eq('activity_id', activityId).eq('youth_id', p.id)
    setBusyId(null)
    if (err) { const m = friendlyError(err); setError(m); return toast.error(m) }
    setAttendees((a) => a.filter((x) => x.id !== p.id))
    router.refresh()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canEdit && (
        <Card>
          <SectionTitle sub="Search by name or youth ID, then tap to mark present">Record attendance</SectionTitle>
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input className={`${inputCls} !pl-12`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type at least 2 letters" aria-label="Search youth" />
          </div>
          {error && <div className="mt-3"><Alert>{error}</Alert></div>}
          <ul className="mt-4 space-y-2">
            {searching && <li className="flex items-center gap-2 text-sm font-bold text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Searching</li>}
            {results.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-[2rem] bg-slate-50 px-5 py-3">
                <div className="min-w-0"><div className="truncate font-black">{p.name}</div><div className="text-xs font-bold text-slate-400">{p.code} / {p.purok}</div></div>
                {present(p.id) ? (
                  <span className="inline-flex items-center gap-1 text-sm font-black text-emerald-700"><Check className="h-4 w-4" /> Present</span>
                ) : (
                  <button onClick={() => mark(p)} disabled={busyId === p.id} className="inline-flex items-center gap-1 rounded-full bg-brand px-4 py-2 text-sm font-black text-white hover:bg-brand-deep disabled:opacity-50">
                    {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Mark
                  </button>
                )}
              </li>
            ))}
            {q.trim().length >= 2 && !searching && results.length === 0 && <li className="text-sm font-semibold text-slate-400">No matching youth.</li>}
          </ul>
        </Card>
      )}

      <Card className={canEdit ? '' : 'lg:col-span-2'}>
        <SectionTitle sub={`${attendees.length} present`}>Attendees</SectionTitle>
        {attendees.length === 0 ? (
          <p className="font-semibold text-slate-500">No attendance recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {attendees.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><div className="truncate font-black">{p.name}</div><div className="text-xs font-bold text-slate-400">{p.code} / {p.purok}</div></div>
                {canEdit && (
                  <button onClick={() => unmark(p)} disabled={busyId === p.id} aria-label={`Remove ${p.name}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
