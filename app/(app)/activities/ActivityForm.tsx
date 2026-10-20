'use client'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Loader2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUS } from '@/lib/constants'
import type { ActivityDetail } from '@/lib/types'
import { Alert, Field, btnGhost, btnPrimary, inputCls, textareaCls } from '@/components/ui'

const group = 'rounded-[2.5rem] bg-white p-6 shadow-[0_1px_2px_rgb(11_18_56/0.04),0_12px_32px_-14px_rgb(11_18_56/0.14)] ring-1 ring-black/5 sm:p-8'
const legend = 'mb-5 text-sm font-black uppercase tracking-widest text-brand'

/** Create or edit an SK activity. The database checks the values again (status, times, budget, lengths). */
export default function ActivityForm({ initial, puroks }: { initial?: ActivityDetail; puroks: { id: string; name: string }[] }) {
  const router = useRouter()
  const toast = useToast()
  const [v, setV] = useState({
    title: initial?.title ?? '',
    category: initial?.category ?? 'other',
    status: initial?.status ?? 'planned',
    activity_date: initial?.activity_date ?? new Date().toISOString().slice(0, 10),
    start_time: initial?.start_time?.slice(0, 5) ?? '',
    end_time: initial?.end_time?.slice(0, 5) ?? '',
    venue: initial?.venue ?? '',
    purok_id: initial?.purok_id ?? '',
    organizer: initial?.organizer ?? '',
    description: initial?.description ?? '',
    objectives: initial?.objectives ?? '',
    target_participants: initial?.target_participants?.toString() ?? '',
    budget: initial?.budget?.toString() ?? '',
    fund_source: initial?.fund_source ?? '',
    partners: initial?.partners ?? '',
    outcome: initial?.outcome ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof v, val: string) => setV({ ...v, [k]: val })
  const fail = (m: string) => { setError(m); toast.error(m) }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!v.title.trim()) return fail('Give the activity a title.')
    if (v.start_time && v.end_time && v.end_time <= v.start_time) return fail('End time must be after the start time.')
    const target = v.target_participants ? Number(v.target_participants) : null
    if (target !== null && (!Number.isInteger(target) || target < 1)) return fail('Target participants must be a whole number above 0.')
    const budget = v.budget ? Number(v.budget) : null
    if (budget !== null && (Number.isNaN(budget) || budget < 0)) return fail('Budget must be 0 or more.')

    const row = {
      title: v.title.trim(), category: v.category, status: v.status, activity_date: v.activity_date,
      start_time: v.start_time || null, end_time: v.end_time || null, venue: v.venue.trim() || null, purok_id: v.purok_id || null,
      organizer: v.organizer.trim() || null, description: v.description.trim() || null, objectives: v.objectives.trim() || null,
      target_participants: target, budget, fund_source: v.fund_source.trim() || null, partners: v.partners.trim() || null,
      outcome: v.outcome.trim() || null,
    }
    setBusy(true)
    const supabase = createClient()
    const res = initial
      ? await supabase.from('activities').update(row).eq('id', initial.id).select('id')
      : await supabase.from('activities').insert(row).select('id')
    setBusy(false)
    if (res.error) return fail(friendlyError(res.error))
    if (!res.data?.length) return fail('You do not have permission to save activities.')
    toast.success(initial ? 'Activity saved.' : 'Activity created. You can now add photos and attendance.')
    router.push(`/activities/${res.data[0].id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="stagger space-y-6" noValidate>
      {error && <Alert>{error}</Alert>}
      <fieldset className={group}>
        <div className={legend}>Basic details</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title" hint="Required" htmlFor="a-title">
              <input id="a-title" className={inputCls} value={v.title} onChange={(e) => set('title', e.target.value)} maxLength={160} placeholder="e.g. Barangay Clean-up Drive" />
            </Field>
          </div>
          <Field label="Category" htmlFor="a-cat">
            <select id="a-cat" className={inputCls} value={v.category} onChange={(e) => set('category', e.target.value)}>
              {ACTIVITY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Status" htmlFor="a-status">
            <select id="a-status" className={inputCls} value={v.status} onChange={(e) => set('status', e.target.value)}>
              {ACTIVITY_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Date" hint="Required" htmlFor="a-date">
            <input id="a-date" type="date" className={inputCls} value={v.activity_date} onChange={(e) => set('activity_date', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" hint="Optional" htmlFor="a-start"><input id="a-start" type="time" className={inputCls} value={v.start_time} onChange={(e) => set('start_time', e.target.value)} /></Field>
            <Field label="End" hint="Optional" htmlFor="a-end"><input id="a-end" type="time" className={inputCls} value={v.end_time} onChange={(e) => set('end_time', e.target.value)} /></Field>
          </div>
          <Field label="Venue" hint="Optional" htmlFor="a-venue">
            <input id="a-venue" className={inputCls} value={v.venue} onChange={(e) => set('venue', e.target.value)} maxLength={160} placeholder="e.g. Barangay covered court" />
          </Field>
          <Field label="Purok" hint="Optional, if for one purok" htmlFor="a-purok">
            <select id="a-purok" className={inputCls} value={v.purok_id} onChange={(e) => set('purok_id', e.target.value)}>
              <option value="">Whole barangay</option>
              {puroks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Organizer or committee" hint="Optional" htmlFor="a-org">
              <input id="a-org" className={inputCls} value={v.organizer} onChange={(e) => set('organizer', e.target.value)} maxLength={120} placeholder="e.g. SK Committee on Environment" />
            </Field>
          </div>
        </div>
      </fieldset>

      <fieldset className={group}>
        <div className={legend}>Plan</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Description" hint="Optional" htmlFor="a-desc">
              <textarea id="a-desc" rows={3} className={textareaCls} value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Objectives" hint="Optional" htmlFor="a-obj">
              <textarea id="a-obj" rows={3} className={textareaCls} value={v.objectives} onChange={(e) => set('objectives', e.target.value)} maxLength={1000} placeholder="What the activity aims to achieve" />
            </Field>
          </div>
          <Field label="Target participants" hint="Optional" htmlFor="a-target">
            <input id="a-target" type="number" min={1} inputMode="numeric" className={inputCls} value={v.target_participants} onChange={(e) => set('target_participants', e.target.value)} />
          </Field>
          <Field label="Partners" hint="Optional" htmlFor="a-partners">
            <input id="a-partners" className={inputCls} value={v.partners} onChange={(e) => set('partners', e.target.value)} maxLength={300} placeholder="e.g. BFP, CENRO, school" />
          </Field>
          <Field label="Budget (PHP)" hint="Optional" htmlFor="a-budget">
            <input id="a-budget" type="number" min={0} step="0.01" inputMode="decimal" className={inputCls} value={v.budget} onChange={(e) => set('budget', e.target.value)} />
          </Field>
          <Field label="Fund source" hint="Optional" htmlFor="a-fund">
            <input id="a-fund" className={inputCls} value={v.fund_source} onChange={(e) => set('fund_source', e.target.value)} maxLength={120} placeholder="e.g. SK Fund, donation" />
          </Field>
        </div>
      </fieldset>

      <fieldset className={group}>
        <div className={legend}>Result</div>
        <Field label="Outcome and accomplishments" hint="Fill in after the activity" htmlFor="a-outcome">
          <textarea id="a-outcome" rows={4} className={textareaCls} value={v.outcome} onChange={(e) => set('outcome', e.target.value)} maxLength={2000} placeholder="What happened, results, lessons learned" />
        </Field>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {initial ? 'Save changes' : 'Create activity'}</button>
        <button type="button" onClick={() => router.back()} className={btnGhost}>Cancel</button>
      </div>
    </form>
  )
}
