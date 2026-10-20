'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Eye, EyeOff, Loader2, RotateCcw, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { Alert, btnDanger, btnGhost, btnSun } from '@/components/ui'

export function ContactReveal({ youthId }: { youthId: string }) {
  const toast = useToast()
  const [value, setValue] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reveal = async () => {
    setBusy(true)
    setError(null)
    const { data, error: err } = await createClient().rpc('get_youth_contact', { p_youth: youthId })
    setBusy(false)
    if (err) { const m = friendlyError(err); setError(m); return toast.error(m) }
    setValue((data as string | null) ?? null)
  }

  return (
    <div>
      {error && <Alert>{error}</Alert>}
      {value === undefined ? (
        <button onClick={reveal} disabled={busy} className={btnGhost}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Reveal mobile number
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-ink px-5 py-2.5 text-lg font-black tracking-wide text-white">{value ?? 'No number on file'}</span>
          <button onClick={() => setValue(undefined)} className={btnGhost}><EyeOff className="h-4 w-4" /> Hide</button>
        </div>
      )}
      <p className="mt-2 text-xs font-semibold text-slate-400">Revealing a number is recorded in the audit log.</p>
    </div>
  )
}

export function ConsentScanUpload({ youthId, hasScan }: { youthId: string; hasScan: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const fail = (m: string) => { setError(m); toast.error(m) }
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File) => {
    setError(null)
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return fail('Upload a PDF, JPG or PNG file.')
    if (file.size > 5 * 1024 * 1024) return fail('The file must be 5 MB or smaller.')
    setBusy(true)
    const supabase = createClient()
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)
    const path = `${youthId}/${Date.now()}-${safe}`
    const up = await supabase.storage.from('consent-scans').upload(path, file, { contentType: file.type })
    if (up.error) { setBusy(false); return fail(friendlyError(up.error)) }
    const { data, error: err } = await supabase.from('youth').update({ consent_scan_path: path }).eq('id', youthId).select('id')
    setBusy(false)
    if (err || !data?.length) return fail(friendlyError(err))
    toast.success('Consent scan uploaded.')
    router.refresh()
  }

  return (
    <div>
      {error && <Alert>{error}</Alert>}
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" aria-label="Consent scan file"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
      <button onClick={() => input.current?.click()} disabled={busy} className={btnSun}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {hasScan ? 'Replace consent scan' : 'Upload consent scan'}
      </button>
    </div>
  )
}

export function DeleteRestore({ youthId, deleted }: { youthId: string; deleted: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!deleted && !window.confirm('Delete this profile? It can be restored by an Admin for 365 days.')) return
    setBusy(true)
    setError(null)
    const { data, error: err } = await createClient().from('youth').update({ deleted_at: deleted ? null : new Date().toISOString() }).eq('id', youthId).select('id')
    setBusy(false)
    if (err || !data?.length) { const m = friendlyError(err); setError(m); return toast.error(m) }
    toast.success(deleted ? 'Profile restored.' : 'Profile deleted. An Admin can restore it.')
    router.refresh()
    if (!deleted) router.push('/youth')
  }

  return (
    <div>
      {error && <Alert>{error}</Alert>}
      <button onClick={run} disabled={busy} className={deleted ? btnGhost : btnDanger}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : deleted ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        {deleted ? 'Restore profile' : 'Delete profile'}
      </button>
    </div>
  )
}
