'use client'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Eye, Loader2, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ProfileFields from '@/components/ProfileFields'
import { useToast } from '@/components/Toast'
import { friendlyError } from '@/lib/errors'
import { anySensitiveShown, toRules } from '@/lib/formSettings'
import { CONSENT_SPI_TEXT, consentVersionFor } from '@/lib/constants'
import type { FormFieldSetting } from '@/lib/types'
import { emptyProfile, type ProfileValues } from '@/lib/validation'
import { Alert, Badge, Card, SectionTitle } from '@/components/ui'

const SENSITIVE_WARNING =
  'Ang relihiyon, PWD at medical na impormasyon ay sensitibong personal na impormasyon sa ilalim ng Data Privacy Act. Ilagay lang kung kailangan talaga para sa programa at ipaliwanag sa consent form.'

const SECTIONS: { key: FormFieldSetting['section']; title: string; sub: string }[] = [
  { key: 'personal', title: 'Personal information', sub: 'Name, birthdate, sex, purok and educational status are always shown and required.' },
  { key: 'other', title: 'Other information', sub: 'Disability, medical, youth organization, skills and interests.' },
]

function Toggle({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'bg-brand' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
    </button>
  )
}

export default function FormSettingsManager({ initial, puroks }: { initial: FormFieldSetting[]; puroks: { id: string; name: string }[] }) {
  const router = useRouter()
  const toast = useToast()
  const [fields, setFields] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ProfileValues>(emptyProfile)
  const rules = useMemo(() => toRules(fields), [fields])
  const byKey = (k: string | null) => fields.find((f) => f.field_key === k)
  const sensitiveOn = anySensitiveShown(rules)

  const save = async (f: FormFieldSetting, next: { is_visible: boolean; is_required: boolean }) => {
    setError(null)
    setBusy(f.field_key)
    const patch = { is_visible: next.is_visible, is_required: next.is_visible && next.is_required }
    const { data, error: err } = await createClient().from('form_fields').update(patch).eq('field_key', f.field_key).select('*')
    setBusy(null)
    if (err || !data?.length) {
      const m = err ? friendlyError(err) : 'You do not have permission to change form settings.'
      setError(m)
      return toast.error(m)
    }
    setFields((list) => list.map((x) => (x.field_key === f.field_key ? (data[0] as FormFieldSetting) : x)))
    toast.success(`${f.label}: ${patch.is_visible ? (patch.is_required ? 'shown and required' : 'shown, optional') : 'hidden'}.`)
    router.refresh()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        {error && <Alert>{error}</Alert>}
        <div className="rounded-[2.5rem] bg-red-50 p-6 ring-1 ring-red-200">
          <p className="flex items-start gap-3 text-sm font-bold text-red-800">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-flag" aria-hidden /> {SENSITIVE_WARNING}
          </p>
          <p className="mt-3 text-xs font-semibold text-red-700">
            {sensitiveOn
              ? `A sensitive field is shown, so new forms use consent version ${consentVersionFor(true)} with an extra paragraph about sensitive information.`
              : `No sensitive field is shown. New forms use consent version ${consentVersionFor(false)}.`}
          </p>
        </div>

        {SECTIONS.map((s) => (
          <Card key={s.key} className="!p-6 sm:!p-8">
            <SectionTitle sub={s.sub}>{s.title}</SectionTitle>
            <ul className="divide-y divide-slate-100">
              {fields.filter((f) => f.section === s.key).map((f) => {
                const children = fields.filter((c) => c.depends_on === f.field_key && c.is_visible)
                const parent = byKey(f.depends_on)
                const hideBlocked = f.is_visible && children.length > 0
                const showBlocked = !f.is_visible && parent !== undefined && !parent.is_visible
                return (
                  <li key={f.field_key} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black">{f.label}</span>
                        {f.is_sensitive && <Badge tone="red">Sensitibo</Badge>}
                        {!f.is_visible && <Badge tone="slate">Hidden</Badge>}
                        {f.is_visible && f.is_required && <Badge tone="blue">Required</Badge>}
                      </div>
                      {parent && <p className="mt-1 text-xs font-semibold text-slate-400">Shown only when it applies to the answer in &quot;{parent.label}&quot;.</p>}
                      {hideBlocked && <p className="mt-1 text-xs font-bold text-amber-700">Itago muna: {children.map((c) => c.label).join(', ')}</p>}
                      {showBlocked && <p className="mt-1 text-xs font-bold text-amber-700">Ipakita muna: {parent?.label}</p>}
                    </div>
                    <div className="flex items-center gap-5">
                      {busy === f.field_key && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                      <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600">
                        Ipakita
                        <Toggle
                          on={f.is_visible}
                          label={`Ipakita ${f.label}`}
                          disabled={busy !== null || hideBlocked || showBlocked}
                          onClick={() => save(f, { is_visible: !f.is_visible, is_required: f.is_required })}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600">
                        Required
                        <Toggle
                          on={f.is_visible && f.is_required}
                          label={`Required ${f.label}`}
                          disabled={busy !== null || !f.is_visible}
                          onClick={() => save(f, { is_visible: f.is_visible, is_required: !f.is_required })}
                        />
                      </label>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}
      </div>

      <div className="xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:self-start xl:overflow-y-auto">
        <Card className="!p-6 sm:!p-8">
          <SectionTitle sub="What youth and encoders see with these settings. Nothing typed here is saved.">
            <span className="inline-flex items-center gap-2"><Eye className="h-6 w-6 text-brand" aria-hidden /> Live preview</span>
          </SectionTitle>
          <ProfileFields values={preview} onChange={setPreview} puroks={puroks} rules={rules} idPrefix="preview" />
          {sensitiveOn && <p className="mt-6 rounded-[2rem] bg-ink p-5 text-sm font-semibold text-white/80">{CONSENT_SPI_TEXT}</p>}
        </Card>
      </div>
    </div>
  )
}
