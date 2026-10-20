'use client'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Loader2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ProfileFields from '@/components/ProfileFields'
import { Alert, Field, btnGhost, btnPrimary, inputCls } from '@/components/ui'
import { CONSENT_VERSION, GUARDIAN_CONSENT_TEXT } from '@/lib/constants'
import { ageOn } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { cleanPhone, emptyProfile, validateProfile, type ProfileValues } from '@/lib/validation'

export default function YouthForm({ mode, puroks, youthId, initial }: {
  mode: 'create' | 'edit'
  puroks: { id: string; name: string }[]
  youthId?: string
  initial?: ProfileValues
}) {
  const router = useRouter()
  const [v, setV] = useState<ProfileValues>(initial ?? emptyProfile)
  const today = new Date().toISOString().slice(0, 10)
  const [consentOn, setConsentOn] = useState(false)
  const [consentDate, setConsentDate] = useState(today)
  const [guardianOk, setGuardianOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const fail = (m: string) => { setError(m); toast.error(m) }

  const age = v.birthdate ? ageOn(v.birthdate) : null
  const isMinor = age !== null && age >= 0 && age < 18

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const problem = validateProfile(v)
    if (problem) return fail(problem)
    if (mode === 'create') {
      if (!consentOn) return fail('Confirm that the signed consent form is on file before saving.')
      if (consentDate > today) return fail('Consent date cannot be in the future.')
      if (isMinor && !guardianOk) return fail('Confirm that the parent or guardian has also signed the consent.')
    }

    setBusy(true)
    const supabase = createClient()
    const fields = {
      first_name: v.first_name, middle_name: v.middle_name || null, last_name: v.last_name, suffix: v.suffix || null,
      birthdate: v.birthdate, sex: v.sex, civil_status: v.civil_status, purok_id: v.purok_id,
      education_status: v.education_status, education_level: v.education_level || null, employment_status: v.employment_status,
      skills: v.skills, interests: v.interests, civic_involvement: v.civic_involvement,
      guardian_name: isMinor ? v.guardian_name : null, guardian_relationship: isMinor ? v.guardian_relationship || null : null,
    }

    let id = youthId
    if (mode === 'create') {
      const consentAt = new Date(`${consentDate}T12:00:00+08:00`).toISOString()
      const { data, error: err } = await supabase
        .from('youth')
        .insert({
          ...fields, consent_version: CONSENT_VERSION, consent_at: consentAt, consent_source: 'form',
          guardian_consent_at: isMinor ? consentAt : null,
        })
        .select('id')
        .single()
      if (err) { setBusy(false); return fail(friendlyError(err)) }
      id = data.id
    } else {
      const { data, error: err } = await supabase.from('youth').update(fields).eq('id', youthId!).select('id')
      if (err) { setBusy(false); return fail(friendlyError(err)) }
      if (!data || data.length === 0) { setBusy(false); return fail('You do not have permission to edit this profile.') }
    }

    const phone = cleanPhone(v.contact_number)
    if (phone && id) {
      const { error: err } = await supabase.rpc('set_youth_contact', { p_youth: id, p_contact: phone })
      if (err) { setBusy(false); return fail(`Profile saved, but the contact number was not: ${friendlyError(err)}`) }
    }
    router.push(`/youth/${id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {error && <Alert>{error}</Alert>}
      <ProfileFields
        values={v}
        onChange={setV}
        puroks={puroks}
        idPrefix={mode}
        contactHint={mode === 'edit' ? 'Leave blank to keep the saved number' : 'Optional. Stored encrypted.'}
      />

      {mode === 'create' && (
        <fieldset className="rounded-[2.5rem] bg-ink p-6 text-white sm:p-8">
          <div className="mb-4 text-sm font-black uppercase tracking-widest text-sun">Consent (Data Privacy Act)</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date consent was signed" htmlFor="consent-date">
              <input id="consent-date" type="date" className={inputCls} value={consentDate} max={today} onChange={(e) => setConsentDate(e.target.value)} required />
            </Field>
            <div className="self-end text-sm font-semibold text-white/60">Version {CONSENT_VERSION}</div>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[1.5rem] bg-white/10 p-4">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[#facc15]" checked={consentOn} onChange={(e) => setConsentOn(e.target.checked)} />
            <span className="text-sm font-black">The youth has signed the data privacy consent form and it is on file with the SK.</span>
          </label>
          {isMinor && (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[1.5rem] bg-amber-300/20 p-4 ring-1 ring-amber-300/40">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[#facc15]" checked={guardianOk} onChange={(e) => setGuardianOk(e.target.checked)} />
              <span className="text-sm font-black">{GUARDIAN_CONSENT_TEXT} (signed copy is on file)</span>
            </label>
          )}
          <p className="mt-3 text-xs font-semibold text-white/50">You can attach a scan of the signed form on the profile page after saving.</p>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {mode === 'create' ? 'Save profile' : 'Save changes'}
        </button>
        <button type="button" onClick={() => router.back()} className={btnGhost}>Cancel</button>
      </div>
    </form>
  )
}
