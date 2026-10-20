'use client'
import { ShieldAlert } from 'lucide-react'
import TagInput from '@/components/TagInput'
import { Field, inputCls } from '@/components/ui'
import {
  AGE_BRACKETS, CIVIC_SUGGESTIONS, CIVIL_OPTIONS, EDU_LEVEL_OPTIONS, EDU_STATUS_OPTIONS, EMPLOYMENT_OPTIONS, INTEREST_SUGGESTIONS,
  SECTOR_OPTIONS, SEX_OPTIONS, SKILL_SUGGESTIONS, YES_NO_OPTIONS,
} from '@/lib/constants'
import { ageOn } from '@/lib/format'
import { DEFAULT_RULES, fieldApplies, required, shown, type FormRules } from '@/lib/formSettings'
import type { Purok } from '@/lib/types'
import type { ProfileValues, YesNo } from '@/lib/validation'

const group = 'rounded-[2.5rem] bg-slate-50 p-6 ring-1 ring-black/5 sm:p-8'
const legend = 'mb-5 text-sm font-black uppercase tracking-widest text-brand'
const sub = 'mb-4 mt-8 text-xs font-black uppercase tracking-widest text-slate-500'

export default function ProfileFields({ values, onChange, puroks, rules = DEFAULT_RULES, contactHint, idPrefix = 'f', youthCode, hideSensitive = false }: {
  values: ProfileValues
  onChange: (next: ProfileValues) => void
  puroks: Pick<Purok, 'id' | 'name'>[]
  /** Form settings from public.form_fields (show / required per field). */
  rules?: FormRules
  contactHint?: string
  idPrefix?: string
  /** "ID No." of an existing profile. New profiles get one automatically. */
  youthCode?: string
  /** Leave out religion, disability and medical even if the settings show them (no -SPI consent on file). */
  hideSensitive?: boolean
}) {
  const set = <K extends keyof ProfileValues>(k: K, v: ProfileValues[K]) => onChange({ ...values, [k]: v })
  const age = values.birthdate ? ageOn(values.birthdate) : null
  const isMinor = age !== null && age < 18 && age >= 0
  const bracket = age !== null ? AGE_BRACKETS.find((b) => age >= b.min && age <= b.max) : undefined
  const id = (n: string) => `${idPrefix}-${n}`
  const sensitive = (k: string) => k === 'religion' || k === 'has_disability' || k === 'has_medical_condition'
  const show = (k: string) => shown(rules, k) && !(hideSensitive && sensitive(k))
  const showIf = (k: string) => show(k) && fieldApplies(k, values)
  const hint = (k: string, optionalHint = 'Optional') => (required(rules, k) ? 'Required' : optionalHint)
  const label = (k: string, fallback: string) => rules[k]?.label ?? fallback

  const yesNo = (k: 'registered_voter' | 'has_disability' | 'has_medical_condition' | 'youth_org_member') => (
    <select id={id(k)} className={inputCls} value={values[k]} onChange={(e) => set(k, e.target.value as YesNo)}>
      <option value="">Not answered</option>
      {YES_NO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
  const sensitiveHint = (k: string) => (
    <span className="mb-2 flex items-center gap-1.5 px-2 text-xs font-bold text-flag"><ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Sensitive. {required(rules, k) ? 'Required.' : 'Voluntary, you may skip it.'}</span>
  )

  const showWork = show('employment_status')
  const showOther = ['has_disability', 'has_medical_condition', 'youth_org_member', 'skills', 'interests', 'civic_involvement'].some(show)

  return (
    <div className="space-y-6">
      <fieldset className={group}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className={legend.replace('mb-5 ', '')}>Personal information</div>
          <span className="rounded-full bg-white px-4 py-1.5 text-xs font-black uppercase tracking-wider text-slate-500 ring-1 ring-black/5">
            ID No. {youthCode ?? 'assigned automatically'}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" hint="Required" htmlFor={id('first')}>
            <input id={id('first')} className={inputCls} value={values.first_name} onChange={(e) => set('first_name', e.target.value)} maxLength={80} required autoComplete="given-name" />
          </Field>
          {show('middle_name') && (
            <Field label={label('middle_name', 'Middle name')} hint={hint('middle_name')} htmlFor={id('middle')}>
              <input id={id('middle')} className={inputCls} value={values.middle_name} onChange={(e) => set('middle_name', e.target.value)} maxLength={80} />
            </Field>
          )}
          <Field label="Last name" hint="Required" htmlFor={id('last')}>
            <input id={id('last')} className={inputCls} value={values.last_name} onChange={(e) => set('last_name', e.target.value)} maxLength={80} required autoComplete="family-name" />
          </Field>
          {show('suffix') && (
            <Field label={label('suffix', 'Suffix')} hint={hint('suffix', 'Jr., III, etc.')} htmlFor={id('suffix')}>
              <input id={id('suffix')} className={inputCls} value={values.suffix} onChange={(e) => set('suffix', e.target.value)} maxLength={10} />
            </Field>
          )}
          <Field label="Birthdate" hint={age !== null && age >= 0 ? `Age ${age}${bracket ? `, ${bracket.label}` : ''}` : 'Age 15 to 30'} htmlFor={id('birth')}>
            <input id={id('birth')} type="date" className={inputCls} value={values.birthdate} onChange={(e) => set('birthdate', e.target.value)} max={new Date().toISOString().slice(0, 10)} required />
          </Field>
          <Field label="Sex" hint="Required" htmlFor={id('sex')}>
            <select id={id('sex')} className={inputCls} value={values.sex} onChange={(e) => set('sex', e.target.value)} required>
              <option value="">Select</option>
              {SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {show('civil_status') && (
            <Field label={label('civil_status', 'Civil status')} hint={hint('civil_status')} htmlFor={id('civil')}>
              <select id={id('civil')} className={inputCls} value={values.civil_status} onChange={(e) => set('civil_status', e.target.value)}>
                <option value="">Not specified</option>
                {CIVIL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          )}
          {show('civil_status') && values.civil_status === 'others' && (
            <Field label="Civil status, please specify" hint="Optional" htmlFor={id('civil-other')}>
              <input id={id('civil-other')} className={inputCls} value={values.civil_status_other} onChange={(e) => set('civil_status_other', e.target.value)} maxLength={60} placeholder="e.g. Annulled" />
            </Field>
          )}
          <Field label="Purok / sitio" hint="Required" htmlFor={id('purok')}>
            <select id={id('purok')} className={inputCls} value={values.purok_id} onChange={(e) => set('purok_id', e.target.value)} required>
              <option value="">Select</option>
              {puroks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          {show('contact_number') && (
            <Field label={label('contact_number', 'Mobile number')} hint={required(rules, 'contact_number') ? `Required. ${contactHint ?? 'Stored encrypted.'}` : contactHint ?? 'Optional. Stored encrypted.'} htmlFor={id('phone')}>
              <input id={id('phone')} type="tel" inputMode="tel" className={inputCls} value={values.contact_number} onChange={(e) => set('contact_number', e.target.value)} placeholder="09171234567" maxLength={20} autoComplete="tel" />
            </Field>
          )}
          {show('email') && (
            <Field label={label('email', 'Email address')} hint={hint('email')} htmlFor={id('email')}>
              <input id={id('email')} type="email" inputMode="email" className={inputCls} value={values.email} onChange={(e) => set('email', e.target.value)} maxLength={120} autoComplete="email" placeholder="name@example.com" />
            </Field>
          )}
          {show('registered_voter') && (
            <Field label={label('registered_voter', 'Registered SK voter')} hint={hint('registered_voter')} htmlFor={id('registered_voter')}>
              {yesNo('registered_voter')}
            </Field>
          )}
          {show('religion') && (
            <Field label={label('religion', 'Religion')} htmlFor={id('religion')}>
              {sensitiveHint('religion')}
              <input id={id('religion')} className={inputCls} value={values.religion} onChange={(e) => set('religion', e.target.value)} maxLength={60} />
            </Field>
          )}
        </div>

        <div className={sub}>Educational background</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Educational status" hint="Required" htmlFor={id('edu')}>
            <select id={id('edu')} className={inputCls} value={values.education_status} onChange={(e) => set('education_status', e.target.value)} required>
              <option value="">Select</option>
              {EDU_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {show('education_level') && (
            <Field label={label('education_level', 'Education level')} hint={required(rules, 'education_level') ? 'Required. Current or last' : 'Current or last'} htmlFor={id('level')}>
              <select id={id('level')} className={inputCls} value={values.education_level} onChange={(e) => set('education_level', e.target.value)}>
                <option value="">Not specified</option>
                {EDU_LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          )}
          {showIf('course') && (
            <Field label={label('course', 'Course')} hint={hint('course', 'Course or program')} htmlFor={id('course')}>
              <input id={id('course')} className={inputCls} value={values.course} onChange={(e) => set('course', e.target.value)} maxLength={120} placeholder="e.g. BS Information Technology" />
            </Field>
          )}
          {showIf('out_of_school_reason') && (
            <div className="sm:col-span-2">
              <Field label={label('out_of_school_reason', 'Reason for not attending school')} hint={hint('out_of_school_reason')} htmlFor={id('osy-reason')}>
                <input id={id('osy-reason')} className={inputCls} value={values.out_of_school_reason} onChange={(e) => set('out_of_school_reason', e.target.value)} maxLength={200} placeholder="e.g. financial problem, working, family reasons" />
              </Field>
            </div>
          )}
        </div>

        {showWork && (
          <>
            <div className={sub}>Work status</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={label('employment_status', 'Work status')} hint={hint('employment_status')} htmlFor={id('emp')}>
                <select id={id('emp')} className={inputCls} value={values.employment_status} onChange={(e) => set('employment_status', e.target.value)}>
                  <option value="">Not specified</option>
                  {EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              {showIf('employment_sector') && (
                <Field label={label('employment_sector', 'Employment sector')} hint={hint('employment_sector')} htmlFor={id('sector')}>
                  <select id={id('sector')} className={inputCls} value={values.employment_sector} onChange={(e) => set('employment_sector', e.target.value)}>
                    <option value="">Not specified</option>
                    {SECTOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              )}
              {showIf('government_agency') && (
                <Field label={label('government_agency', 'Government agency')} hint={hint('government_agency')} htmlFor={id('agency')}>
                  <input id={id('agency')} className={inputCls} value={values.government_agency} onChange={(e) => set('government_agency', e.target.value)} maxLength={120} placeholder="e.g. DepEd, LGU" />
                </Field>
              )}
              {showIf('employment_duration') && (
                <Field label={label('employment_duration', 'Length of employment')} hint={hint('employment_duration')} htmlFor={id('duration')}>
                  <input id={id('duration')} className={inputCls} value={values.employment_duration} onChange={(e) => set('employment_duration', e.target.value)} maxLength={60} placeholder="e.g. 2 years" />
                </Field>
              )}
            </div>
          </>
        )}
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

      {showOther && (
        <fieldset className={group}>
          <div className={legend}>Other information</div>
          <div className="space-y-5">
            {(show('has_disability') || show('has_medical_condition')) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {show('has_disability') && (
                  <div className="space-y-3">
                    <Field label={label('has_disability', 'Person with disability (PWD)')} htmlFor={id('has_disability')}>
                      {sensitiveHint('has_disability')}
                      {yesNo('has_disability')}
                    </Field>
                    {values.has_disability === 'yes' && (
                      <Field label="Type of disability" hint="Optional" htmlFor={id('disability_details')}>
                        <input id={id('disability_details')} className={inputCls} value={values.disability_details} onChange={(e) => set('disability_details', e.target.value)} maxLength={200} />
                      </Field>
                    )}
                  </div>
                )}
                {show('has_medical_condition') && (
                  <div className="space-y-3">
                    <Field label={label('has_medical_condition', 'Medical condition')} htmlFor={id('has_medical_condition')}>
                      {sensitiveHint('has_medical_condition')}
                      {yesNo('has_medical_condition')}
                    </Field>
                    {values.has_medical_condition === 'yes' && (
                      <Field label="Medical condition, please specify" hint="Optional" htmlFor={id('medical_details')}>
                        <input id={id('medical_details')} className={inputCls} value={values.medical_details} onChange={(e) => set('medical_details', e.target.value)} maxLength={200} />
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}
            {show('youth_org_member') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={label('youth_org_member', 'Member of a youth organization')} hint={hint('youth_org_member')} htmlFor={id('youth_org_member')}>
                  {yesNo('youth_org_member')}
                </Field>
                {values.youth_org_member === 'yes' && (
                  <Field label="Name of the organization" hint="Required" htmlFor={id('youth_org_name')}>
                    <input id={id('youth_org_name')} className={inputCls} value={values.youth_org_name} onChange={(e) => set('youth_org_name', e.target.value)} maxLength={120} placeholder="e.g. Red Cross Youth" />
                  </Field>
                )}
              </div>
            )}
            {show('skills') && (
              <Field label={label('skills', 'Skills')} hint={hint('skills')} htmlFor={id('skills')}>
                <TagInput id={id('skills')} value={values.skills} onChange={(v) => set('skills', v)} suggestions={SKILL_SUGGESTIONS} />
              </Field>
            )}
            {show('interests') && (
              <Field label={label('interests', 'Interests')} hint={hint('interests')} htmlFor={id('interests')}>
                <TagInput id={id('interests')} value={values.interests} onChange={(v) => set('interests', v)} suggestions={INTEREST_SUGGESTIONS} />
              </Field>
            )}
            {show('civic_involvement') && (
              <Field label={label('civic_involvement', 'Civic involvement')} hint={required(rules, 'civic_involvement') ? 'Required' : 'SK activities, organizations, volunteer work'} htmlFor={id('civic')}>
                <TagInput id={id('civic')} value={values.civic_involvement} onChange={(v) => set('civic_involvement', v)} suggestions={CIVIC_SUGGESTIONS} />
              </Field>
            )}
          </div>
        </fieldset>
      )}
    </div>
  )
}
