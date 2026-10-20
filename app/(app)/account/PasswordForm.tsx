'use client'
import { useState, type FormEvent } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { Alert, Card, Field, SectionTitle, btnPrimary, inputCls } from '@/components/ui'

export default function PasswordForm({ email }: { email: string }) {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fail = (m: string) => { setError(m); toast.error(m) }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!current) return fail('Enter your current password.')
    if (next.length < 8) return fail('The new password must be at least 8 characters.')
    if (next === current) return fail('The new password must be different from the current one.')
    if (next !== confirm) return fail('The new passwords do not match.')

    setBusy(true)
    const supabase = createClient()
    // Re-check the current password first so a borrowed, unlocked session cannot silently change it.
    const check = await supabase.auth.signInWithPassword({ email, password: current })
    if (check.error) { setBusy(false); return fail('The current password is incorrect.') }
    const { error: err } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (err) return fail(friendlyError(err))
    setCurrent(''); setNext(''); setConfirm('')
    toast.success('Password changed.')
  }

  return (
    <Card>
      <SectionTitle sub="Use at least 8 characters. You stay signed in on this device.">Change password</SectionTitle>
      <form onSubmit={submit} className="grid max-w-xl gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Current password" htmlFor="pw-current">
          <input id="pw-current" type="password" autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" htmlFor="pw-new">
          <input id="pw-new" type="password" autoComplete="new-password" minLength={8} className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm">
          <input id="pw-confirm" type="password" autoComplete="new-password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <div>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Update password
          </button>
        </div>
      </form>
    </Card>
  )
}
