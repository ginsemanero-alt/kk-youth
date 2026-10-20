import { ClipboardCheck } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/errors'
import { CIVIL_OPTIONS, EDU_LEVEL_OPTIONS, SECTOR_OPTIONS, label, yesNo } from '@/lib/constants'
import { formatDateTime, ageOn } from '@/lib/format'
import { formatAnswer, loadQuestions } from '@/lib/customQuestions'
import type { PendingRegistration } from '@/lib/types'
import { Card, EducationBadge, EmploymentBadge, EmptyState, Pill, PageHeader, RegistrationBadge, SectionTitle, Badge } from '@/components/ui'
import RegistrationActions from './RegistrationActions'
import RegistrationQr from './RegistrationQr'

export const metadata = { title: 'Registrations' }
export const dynamic = 'force-dynamic'

export default async function RegistrationsPage() {
  await requireRole(['admin', 'encoder'], '/registrations')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pending_registrations')
    .select('id, first_name, middle_name, last_name, suffix, birthdate, sex, civil_status, civil_status_other, purok_id, education_status, education_level, course, out_of_school_reason, employment_status, employment_sector, employment_duration, government_agency, email, registered_voter, youth_org_member, youth_org_name, religion, has_disability, disability_details, has_medical_condition, medical_details, custom_answers, skills, interests, civic_involvement, consent_version, consent_at, guardian_name, guardian_relationship, status, rejection_reason, created_at, puroks(name)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(friendlyError(error))
  const rows = (data ?? []) as unknown as PendingRegistration[]
  const questions = await loadQuestions(supabase)
  const pending = rows.filter((r) => r.status === 'pending')
  const done = rows.filter((r) => r.status !== 'pending')

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Self-registration" title="Registrations" subtitle="Submissions from the public form wait here. Nothing enters the registry until an encoder approves it." />
      <RegistrationQr />

      <section>
        <SectionTitle sub={`${pending.length} waiting`}>Pending review</SectionTitle>
        {pending.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nothing to review" hint="New submissions will appear here." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((r) => (
              <Card key={r.id} className="!p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <RegistrationBadge status={r.status} />
                  {ageOn(r.birthdate) < 18 && <Badge tone="sun">Minor</Badge>}
                  <span className="text-xs font-bold text-slate-400">{formatDateTime(r.created_at)}</span>
                </div>
                <h3 className="mt-3 text-2xl font-black">{r.first_name} {r.middle_name ?? ''} {r.last_name} {r.suffix ?? ''}</h3>
                <p className="text-sm font-semibold text-slate-500">{ageOn(r.birthdate)} yrs / {r.sex} / {r.puroks?.name}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <EducationBadge status={r.education_status} />
                  <EmploymentBadge status={r.employment_status} />
                  {r.education_level && <Pill>{label(EDU_LEVEL_OPTIONS, r.education_level)}</Pill>}
                </div>
                <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                  {r.civil_status && <div><dt className="inline font-black">Civil status: </dt><dd className="inline">{r.civil_status === 'others' ? r.civil_status_other || 'Others' : label(CIVIL_OPTIONS, r.civil_status)}</dd></div>}
                  {r.email && <div><dt className="inline font-black">Email: </dt><dd className="inline break-all">{r.email}</dd></div>}
                  {r.registered_voter !== null && <div><dt className="inline font-black">SK voter: </dt><dd className="inline">{yesNo(r.registered_voter)}</dd></div>}
                  {r.course && <div><dt className="inline font-black">Course: </dt><dd className="inline">{r.course}</dd></div>}
                  {r.out_of_school_reason && <div className="sm:col-span-2"><dt className="inline font-black">Not in school because: </dt><dd className="inline">{r.out_of_school_reason}</dd></div>}
                  {r.employment_sector && <div><dt className="inline font-black">Sector: </dt><dd className="inline">{label(SECTOR_OPTIONS, r.employment_sector)}{r.government_agency ? ` (${r.government_agency})` : ''}</dd></div>}
                  {r.employment_duration && <div><dt className="inline font-black">Employed for: </dt><dd className="inline">{r.employment_duration}</dd></div>}
                  {r.youth_org_member !== null && <div><dt className="inline font-black">Youth org: </dt><dd className="inline">{r.youth_org_member ? r.youth_org_name : 'No'}</dd></div>}
                </dl>
                {(r.religion || r.has_disability !== null || r.has_medical_condition !== null) && (
                  <div className="mt-3 rounded-[1.5rem] bg-red-50 p-4 text-sm font-semibold text-red-800 ring-1 ring-red-200">
                    <Badge tone="red">Sensitive</Badge>
                    {r.religion && <p className="mt-2">Religion: {r.religion}</p>}
                    {r.has_disability !== null && <p className="mt-1">PWD: {r.has_disability ? r.disability_details || 'Yes' : 'No'}</p>}
                    {r.has_medical_condition !== null && <p className="mt-1">Medical condition: {r.has_medical_condition ? r.medical_details || 'Yes' : 'No'}</p>}
                  </div>
                )}
                {questions.some((q) => r.custom_answers?.[q.id] !== undefined) && (
                  <dl className="mt-3 space-y-1 rounded-[1.5rem] bg-slate-50 p-4 text-sm font-semibold text-slate-600 ring-1 ring-black/5">
                    {questions.filter((q) => r.custom_answers?.[q.id] !== undefined).map((q) => (
                      <div key={q.id} className={q.is_sensitive ? 'text-red-800' : ''}>
                        <dt className="inline font-black">{q.label}{q.is_sensitive ? ' (sensitive)' : ''}: </dt>
                        <dd className="inline">{formatAnswer(r.custom_answers[q.id])}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {r.guardian_name && <p className="mt-3 text-sm font-bold text-amber-800">Guardian: {r.guardian_name}{r.guardian_relationship ? ` (${r.guardian_relationship})` : ''}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">{[...r.skills, ...r.interests].slice(0, 8).map((t) => <Pill key={t}>{t}</Pill>)}</div>
                <RegistrationActions id={r.id} />
              </Card>
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <SectionTitle>Recently reviewed</SectionTitle>
          <div className="overflow-x-auto rounded-[3rem] bg-white shadow-sm ring-1 ring-black/5">
            <table className="w-full min-w-[560px] text-left">
              <tbody>
                {done.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-8 py-4 font-black">{r.first_name} {r.last_name}</td>
                    <td className="px-4 py-4"><RegistrationBadge status={r.status} /></td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-500">{r.rejection_reason ?? ''}</td>
                    <td className="px-8 py-4 text-sm font-semibold text-slate-400">{formatDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
