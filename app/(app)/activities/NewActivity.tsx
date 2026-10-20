'use client'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/Modal'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { ACTIVITY_CATEGORIES } from '@/lib/constants'
import { Alert, Field, btnPrimary, inputCls, textareaCls } from '@/components/ui'

export default function NewActivity() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [venue, setVenue] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const fail = (m: string) => { setError(m); toast.error(m) }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { data, error: err } = await createClient().from('activities')
      .insert({ title: title.trim(), category, activity_date: date, venue: venue.trim() || null, description: description.trim() || null })
      .select('id').single()
    setBusy(false)
    if (err) return fail(friendlyError(err))
    setOpen(false)
    router.push(`/activities/${data.id}`)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnPrimary}><Plus className="h-4 w-4" /> New activity</button>
      {open && (
        <Modal title="New activity" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Title" htmlFor="a-title"><input id="a-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="a-cat">
                <select id="a-cat" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {ACTIVITY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Date" htmlFor="a-date"><input id="a-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
            </div>
            <Field label="Venue" hint="Optional" htmlFor="a-venue"><input id="a-venue" className={inputCls} value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={160} /></Field>
            <Field label="Description" hint="Optional" htmlFor="a-desc"><textarea id="a-desc" rows={3} className={textareaCls} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></Field>
            <button type="submit" disabled={busy || !title.trim()} className={`${btnPrimary} w-full`}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create activity</button>
          </form>
        </Modal>
      )}
    </>
  )
}
