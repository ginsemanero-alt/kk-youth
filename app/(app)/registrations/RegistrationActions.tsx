'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/Modal'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { Alert, Field, btnDanger, btnDark, btnGhost, textareaCls } from '@/components/ui'

export default function RegistrationActions({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const approve = async () => {
    setError(null); setBusy('approve')
    const { error: err } = await createClient().rpc('approve_registration', { p_id: id })
    setBusy(null)
    if (err) { const m = friendlyError(err); setError(m); return toast.error(m) }
    toast.success('Registration approved and added to the registry.')
    router.refresh()
  }

  const reject = async () => {
    setError(null); setBusy('reject')
    const { error: err } = await createClient().rpc('reject_registration', { p_id: id, p_reason: reason })
    setBusy(null)
    if (err) { const m = friendlyError(err); setError(m); return toast.error(m) }
    setRejecting(false)
    toast.success('Registration rejected.')
    router.refresh()
  }

  return (
    <div className="mt-5 space-y-3">
      {error && <Alert>{error}</Alert>}
      <div className="flex gap-2">
        <button onClick={approve} disabled={busy !== null} className={btnDark}>
          {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
        </button>
        <button onClick={() => setRejecting(true)} disabled={busy !== null} className={btnGhost}><X className="h-4 w-4" /> Reject</button>
      </div>
      {rejecting && (
        <Modal title="Reject registration" onClose={() => setRejecting(false)}>
          <Field label="Reason" hint="Optional, kept in the log" htmlFor="reason">
            <textarea id="reason" rows={3} className={textareaCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </Field>
          <button onClick={reject} disabled={busy !== null} className={`${btnDanger} mt-4 w-full`}>
            {busy === 'reject' && <Loader2 className="h-4 w-4 animate-spin" />} Reject registration
          </button>
        </Modal>
      )}
    </div>
  )
}
