'use client'
import TagInput from '@/components/TagInput'
import { Field, inputCls } from '@/components/ui'
import { CIVIC_SUGGESTIONS, CIVIL_OPTIONS, EDU_LEVEL_OPTIONS, EDU_STATUS_OPTIONS, EMPLOYMENT_OPTIONS, INTEREST_SUGGESTIONS, SEX_OPTIONS, SKILL_SUGGESTIONS } from '@/lib/constants'
import { ageOn } from '@/lib/format'
import type { Purok } from '@/lib/types'
import type { ProfileValues } from '@/lib/validation'

const group = 'rounded-[2.5rem] bg-slate-50 p-6 ring-1 ring-black/5 sm:p-8'
const legend = 'mb-5 text-sm font-black uppercase tracking-widest text-brand'

export default function ProfileFields({ values, onChange, puroks, contactHint, idPrefix = 'f' }: {
  values: ProfileValues
  onChange: (next: ProfileValues) => void
  puroks: Pick<Purok, 'id' | 'name'>[]
  contactHint?: string
  idPrefix?: string
}) {
  const set = <K extends keyof ProfileValues>(k: K, v: ProfileValues[K]) => onChange({ ...values, [k]: v })
  const age = values.birthdate ? ageOn(values.birthdate) : null
  const isMinor = age !== null && age < 18 && age >= 0
  const id = (n: string) => `${idPrefix}-${n}`

  return (
    <div className="space-y-6">
      <fieldset className={group}>
        <div className={legend}>Personal information</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor={id('first')}>
            <input id={id('first')} className={inputCls} value={values.first_name} onChange={(e) => set('first_name', e.target.value)} maxLength={80} required autoComplete="given-name" />
          </Field>
          <Field label="Middle name" hint="Optional" htmlFor={id('middle')}>
            <input id={id('middle')} className={inputCls} value={values.middle_name} onChange={(e) => set('middle_name', e.target.value)} maxLength={80} />
          </Field>
          <Field label="Last name" htmlFor={id('last')}>
            <input id={id('last')} className={inputCls} value={values.last_name} onChange={(e) => set('last_name', e.target.value)} maxLength={80} required autoComplete="family-name" />
          </Field>
          <Field label="Suffix" hint="Jr., III, etc." htmlFor={id('suffix')}>
            <input id={id('suffix')} className={inputCls} value={values.suffix} onChange={(e) => set('suffix', e.target.value)} maxLength={10} />
          </Field>
          <Field label="Birthdate" hint={age !== null && age >= 0 ? `Age ${age}` : 'Age 15 to 30'} htmlFor={id('birth')}>
            <input id={id('birth')} type="date" className={inputCls} value={values.birthdate} onChange={(e) => set('birthdate', e.target.value)} max={new Date().toISOString().slice(0, 10)} required />
          </Field>
          <Field label="Sex" htmlFor={id('sex')}>
            <select id={id('sex')} className={inputCls} value={values.sex} onChange={(e) => set('sex', e.target.value)} required>
              <option value="">Select</option>
              {SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Civil status" htmlFor={id('civil')}>
            <select id={id('civil')} className={inputCls} value={values.civil_status} onChange={(e) => set('civil_status', e.target.value)}>
              {CIVIL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Purok / sitio" htmlFor={id('purok')}>
            <select id={id('purok')} className={inputCls} value={values.purok_id} onChange={(e) => set('purok_id', e.target.value)} required>
              <option value="">Select</option>
              {puroks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Mobile number" hint={contactHint ?? 'Optional. Stored encrypted.'} htmlFor={id('phone')}>
              <input id={id('phone')} type="tel" inputMode="tel" className={inputCls} value={values.contact_number} onChange={(e) => set('contact_number', e.target.value)} placeholder="09171234567" maxLength={20} autoComplete="tel" />
            </Field>
          </div>
        </div>
      </fieldset>

      {isMinor && (
        <fieldset className="rounded-[2.5rem] bg-amber-50 p-6 ring-1 ring-amber-200 sm:p-8">
          <div className="mb-5 text-sm font-black uppercase tracking-widest text-amber-800">Parent or guardian (required below 18)</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Parent / guardian name" htmlFor={id('gname')}>
              <input id={id('gname')} className={inputCls} value={values.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} maxLength={120} required />
            </Field>
            <Field label="Relationship" htmlFor={id('grel')}>
              <input id={id('grel')} className={inputCls} value={values.guardian_relationship} onChange={(e) => set('guardian_relationship', e.target.value)} maxLength={60} placeholder="Mother, father, aunt..." />
            </Field>
          </div>
        </fieldset>
      )}

      <fieldset className={group}>
        <div className={legend}>Education and employment</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Educational status" htmlFor={id('edu')}>
            <select id={id('edu')} className={inputCls} value={values.education_status} onChange={(e) => set('education_status', e.target.value)} required>
              <option value="">Select</option>
              {EDU_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Level" hint="Current or last" htmlFor={id('level')}>
            <select id={id('level')} className={inputCls} value={values.education_level} onChange={(e) => set('education_level', e.target.value)}>
              <option value="">Not specified</option>
              {EDU_LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Employment" htmlFor={id('emp')}>
            <select id={id('emp')} className={inputCls} value={values.employment_status} onChange={(e) => set('employment_status', e.target.value)}>
              {EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className={group}>
        <div className={legend}>Skills, interests and civic involvement</div>
        <div className="space-y-5">
          <Field label="Skills" htmlFor={id('skills')}>
            <TagInput id={id('skills')} value={values.skills} onChange={(v) => set('skills', v)} suggestions={SKILL_SUGGESTIONS} />
          </Field>
          <Field label="Interests" htmlFor={id('interests')}>
            <TagInput id={id('interests')} value={values.interests} onChange={(v) => set('interests', v)} suggestions={INTEREST_SUGGESTIONS} />
          </Field>
          <Field label="Civic involvement" hint="SK activities, organizations, volunteer work" htmlFor={id('civic')}>
            <TagInput id={id('civic')} value={values.civic_involvement} onChange={(v) => set('civic_involvement', v)} suggestions={CIVIC_SUGGESTIONS} />
          </Field>
        </div>
      </fieldset>
    </div>
  )
}
