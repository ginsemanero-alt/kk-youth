'use client'
import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, CircleCheck, Loader2, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ProfileFields from '@/components/ProfileFields'
import { Alert, Card, btnPrimary } from '@/components/ui'
import { GUARDIAN_CONSENT_TEXT, consentTextFor, consentVersionFor } from '@/lib/constants'
import { ageOn } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { anySensitiveShown, toRules } from '@/lib/formSettings'
import type { FormFieldSetting } from '@/lib/types'
import { useToast } from '@/components/Toast'
import { cleanPhone, emptyProfile, profilePayload, validateProfile, type ProfileValues } from '@/lib/validation'

export default function RegisterForm({ puroks, settings }: { puroks: { id: string; name: string }[]; settings: FormFieldSetting[] }) {
  const rules = useMemo(() => toRules(settings), [settings])
  const [v, setV] = useState<ProfileValues>(emptyProfile)
  const [consent, setConsent] = useState(false)
  const [guardianConsent, setGuardianConsent] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const fail = (m: string) => { setError(m); toast.error(m) }
  const [done, setDone] = useState(false)

  const age = v.birthdate ? ageOn(v.birthdate) : null
  const isMinor = age !== null && age >= 0 && age < 18
  const sensitiveShown = anySensitiveShown(rules)
  const version = consentVersionFor(sensitiveShown)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const problem = validateProfile(v, rules)
    if (problem) return fail(problem)
    if (!consent) return fail('Please read and accept the data privacy consent to continue.')
    if (isMinor && !guardianConsent) return fail('A parent or guardian must agree to the consent for youth below 18.')
    if (honeypot) return setDone(true) // bots fill hidden fields; pretend success

    setBusy(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('pending_registrations').insert({
      ...profilePayload(v, rules, { isMinor, includeSensitive: true }),
      contact_number: cleanPhone(v.contact_number) || null,
      consent_version: version,
    })
    setBusy(false)
    if (err) return fail(friendlyError(err))
    setDone(true)
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-12">
        <Card className="text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CircleCheck className="h-10 w-10" /></span>
          <h1 className="mt-6 text-4xl font-black tracking-tight">Submitted!</h1>
          <p className="mt-3 font-semibold text-slate-600">Thank you. An SK encoder will review your registration. You do not need to do anything else.</p>
          <Link href="/" className={`${btnPrimary} mt-8`}>Back to home</Link>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Home</Link>
      <span className="block w-fit rounded-full bg-sun px-4 py-1.5 text-xs font-black uppercase tracking-widest">Ages 15 to 30</span>
      <h1 className="mt-3 text-5xl font-black tracking-tight">Youth registration</h1>
      <p className="mt-2 font-semibold text-slate-500">Katipunan ng Kabataan youth profile. Takes about three minutes. Your answers are reviewed by an SK encoder before they are added to the registry.</p>

      <form onSubmit={submit} className="mt-8 space-y-6" noValidate>
        {error && <Alert>{error}</Alert>}
        <ProfileFields values={v} onChange={setV} puroks={puroks} rules={rules} idPrefix="reg" />

        {/* Honeypot: hidden from people, visible to bots */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
        </div>

        <fieldset className="rounded-[2.5rem] bg-ink p-6 text-white sm:p-8">
          <div className="mb-3 text-sm font-black uppercase tracking-widest text-sun">Data privacy consent</div>
          <div className="space-y-2 text-sm font-semibold text-white/80">
            {consentTextFor(sensitiveShown).map((t, i) => (
              <p key={i} className={sensitiveShown && i === consentTextFor(true).length - 1 ? 'rounded-[1.5rem] bg-flag/20 p-4 text-white/90 ring-1 ring-flag/40' : ''}>{t}</p>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-white/50">Version {version}. <Link href="/privacy" target="_blank" className="underline">Full privacy notice</Link></p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[1.5rem] bg-white/10 p-4">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[#facc15]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span className="text-sm font-black">I have read and I agree to the data privacy consent.</span>
          </label>
          {isMinor && (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[1.5rem] bg-amber-300/20 p-4 ring-1 ring-amber-300/40">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[#facc15]" checked={guardianConsent} onChange={(e) => setGuardianConsent(e.target.checked)} />
              <span className="text-sm font-black">{GUARDIAN_CONSENT_TEXT}</span>
            </label>
          )}
        </fieldset>

        <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-4 text-base`}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Submit registration
        </button>
      </form>
    </main>
  )
}
