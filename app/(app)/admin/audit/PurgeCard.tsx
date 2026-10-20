'use client'
import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { Alert, Field, btnDanger, inputCls } from '@/components/ui'

export default function PurgeCard() {
  const toast = useToast()
  const [days, setDays] = useState(365)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const run = async () => {
    if (!window.confirm(`Permanently remove profiles deleted more than ${days} days ago? This cannot be undone.`)) return
    setBusy(true); setMsg(null)
    const { data, error } = await createClient().rpc('purge_soft_deleted', { p_older_than_days: days })
    setBusy(false)
    if (error) { const m = friendlyError(error); setMsg({ tone: 'error', text: m }); return toast.error(m) }
    const text = `${data as number} profile(s) permanently removed.`
    setMsg({ tone: 'success', text })
    toast.success(text)
  }

  return (
    <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-[auto_auto] sm:items-end sm:justify-start">
      <Field label="Purge profiles deleted more than (days) ago" htmlFor="purge-days">
        <input id="purge-days" type="number" min={30} className={inputCls} value={days} onChange={(e) => setDays(Math.max(30, Number(e.target.value) || 365))} />
      </Field>
      <button onClick={run} disabled={busy} className={btnDanger}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Purge now</button>
      {msg && <div className="sm:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
    </div>
  )
}
