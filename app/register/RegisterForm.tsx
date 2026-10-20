'use client'
import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { CircleCheck, Loader2, Send } from 'lucide-react'
import PublicHeader from '@/components/PublicHeader'
import { Logo } from '@/components/Logo'
import { createClient } from '@/lib/supabase/client'
import ProfileFields from '@/components/ProfileFields'
import { Alert, Card, btnPrimary } from '@/components/ui'
import { GUARDIAN_CONSENT_TEXT, ORG, consentTextFor, consentVersionFor } from '@/lib/constants'
import { ageOn } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { sensitiveAsked, toRules } from '@/lib/formSettings'
import type { CustomQuestion, FormFieldSetting } from '@/lib/types'
import { useToast } from '@/components/Toast'
import { cleanPhone, emptyProfile, profilePayload, validateProfile, type ProfileValues } from '@/lib/validation'

export default function RegisterForm({ puroks, settings, questions }: {
  puroks: { id: string; name: string }[]
  settings: FormFieldSetting[]
  questions: CustomQuestion[]
}) {
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
  const sensitiveShown = sensitiveAsked(rules, questions)
  const version = consentVersionFor(sensitiveShown)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const problem = validateProfile(v, rules, { questions })
    if (problem) return fail(problem)
    if (!consent) return fail('Please read and accept the data privacy consent to continue.')
    if (isMinor && !guardianConsent) return fail('A parent or guardian must agree to the consent for youth below 18.')
    if (honeypot) return setDone(true) // bots fill hidden fields; pretend success

    setBusy(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('pending_registrations').insert({
      ...profilePayload(v, rules, { isMinor, includeSensitive: true, questions }),
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
        <Card className="animate-pop text-center">
          <div className="relative mx-auto w-fit animate-float">
            <Logo size={96} />
            <span className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white ring-4 ring-white"><CircleCheck className="h-6 w-6" /></span>
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight">Submitted!</h1>
          <p className="mt-3 font-semibold text-slate-600">Thank you. An SK encoder will review your registration. You do not need to do anything else.</p>
          <Link href="/" className={`${btnPrimary} mt-8`}>Back to home</Link>
        </Card>
      </main>
    )
  }

  return (
    <>
    <PublicHeader />
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <div className="relative isolate animate-rise overflow-hidden rounded-[3.5rem] bg-linear-to-br from-ink via-ink to-brand-deep p-8 text-white shadow-2xl shadow-ink/20 sm:p-10">
        <div className="absolute -right-16 -top-16 -z-10 h-56 w-56 animate-drift rounded-full bg-sun/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-20 -left-10 -z-10 h-56 w-56 animate-drift rounded-full bg-flag/25 blur-3xl [animation-delay:-9s]" aria-hidden />
        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="block w-fit rounded-full bg-sun px-4 py-1.5 text-xs font-black uppercase tracking-widest text-ink">Ages 15 to 30</span>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Youth registration</h1>
            <p className="mt-2 font-semibold text-white/75">Katipunan ng Kabataan youth profile of {ORG.barangay}. Takes about three minutes. An SK encoder reviews your answers before they are added to the registry.</p>
          </div>
          <div className="relative w-fit animate-float">
            <div className="tri-ring absolute -inset-2 animate-spin-slow rounded-full" aria-hidden />
            <div className="absolute -inset-0.5 rounded-full bg-ink" aria-hidden />
            <Logo size={112} preload className="relative !ring-4" />
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-6" noValidate>
        {error && <Alert>{error}</Alert>}
        <ProfileFields values={v} onChange={setV} puroks={puroks} rules={rules} questions={questions} idPrefix="reg" />

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
            <input type="checkbox" className="mt-1 h-5 w-5 accent-sun" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span className="text-sm font-black">I have read and I agree to the data privacy consent.</span>
          </label>
          {isMinor && (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[1.5rem] bg-amber-300/20 p-4 ring-1 ring-amber-300/40">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-sun" checked={guardianConsent} onChange={(e) => setGuardianConsent(e.target.checked)} />
              <span className="text-sm font-black">{GUARDIAN_CONSENT_TEXT}</span>
            </label>
          )}
        </fieldset>

        <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-4 text-base`}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Submit registration
        </button>
      </form>
    </main>
    </>
  )
}
