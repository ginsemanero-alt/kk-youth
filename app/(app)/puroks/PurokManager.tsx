'use client'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Check, Loader2, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import type { CountItem, Purok } from '@/lib/types'
import { Alert, EmptyState, Field, btnDark, btnGhost, btnPrimary, inputCls } from '@/components/ui'

export default function PurokManager({ puroks, counts }: { puroks: Purok[]; counts: CountItem[] }) {
  const router = useRouter()
  const toast = useToast()
  const fail = (m: string) => { setError(m); toast.error(m) }
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const count = (n: string) => counts.find((c) => c.label === n)?.count ?? 0

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: err } = await createClient().from('puroks').insert({ name: name.trim(), description: description.trim() || null })
    setBusy(false)
    if (err) return fail(err.code === '23505' ? 'A purok with that name already exists.' : friendlyError(err))
    toast.success('Purok added.')
    setName(''); setDescription('')
    router.refresh()
  }

  const save = async (id: string) => {
    setError(null)
    const { data, error: err } = await createClient().from('puroks').update({ name: editName.trim(), description: editDesc.trim() || null }).eq('id', id).select('id')
    if (err || !data?.length) return fail(err?.code === '23505' ? 'A purok with that name already exists.' : friendlyError(err))
    toast.success('Purok updated.')
    setEditId(null)
    router.refresh()
  }

  const remove = async (p: Purok) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return
    setError(null)
    const { error: err } = await createClient().from('puroks').update({ deleted_at: new Date().toISOString() }).eq('id', p.id)
    if (err) return fail(friendlyError(err))
    toast.success('Purok deleted.')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <form onSubmit={add} className="grid gap-4 rounded-[3.5rem] bg-white p-8 shadow-sm ring-1 ring-black/5 sm:grid-cols-[1fr_2fr_auto] sm:items-end sm:p-10">
        <Field label="Purok / sitio name" htmlFor="pname"><input id="pname" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Purok 5" maxLength={80} required /></Field>
        <Field label="Description" hint="Optional" htmlFor="pdesc"><input id="pdesc" className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} /></Field>
        <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add</button>
      </form>

      {puroks.length === 0 ? (
        <EmptyState icon={MapPin} title="No puroks yet" hint="Add the puroks or sitios of your barangay above." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {puroks.map((p) => (
            <div key={p.id} className="rounded-[3rem] bg-white p-7 shadow-sm ring-1 ring-black/5">
              {editId === p.id ? (
                <div className="space-y-3">
                  <input aria-label="Name" className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
                  <input aria-label="Description" className={inputCls} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={300} placeholder="Description" />
                  <div className="flex gap-2">
                    <button onClick={() => save(p.id)} className={btnDark}><Check className="h-4 w-4" /> Save</button>
                    <button onClick={() => setEditId(null)} className={btnGhost}><X className="h-4 w-4" /> Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-black leading-tight">{p.name}</h3>
                      {p.description && <p className="mt-1 text-sm font-semibold text-slate-500">{p.description}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-soft px-3.5 py-1 text-xs font-black uppercase tracking-wider text-brand-deep">{count(p.name)} youth</span>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <button onClick={() => { setEditId(p.id); setEditName(p.name); setEditDesc(p.description ?? '') }} className={btnGhost}><Pencil className="h-4 w-4" /> Edit</button>
                    <button onClick={() => remove(p)} className={`${btnGhost} !text-flag`}><Trash2 className="h-4 w-4" /> Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
