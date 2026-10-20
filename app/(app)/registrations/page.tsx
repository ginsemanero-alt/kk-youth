import { ClipboardCheck } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/errors'
import { EDU_LEVEL_OPTIONS, label } from '@/lib/constants'
import { formatDateTime, ageOn } from '@/lib/format'
import type { PendingRegistration } from '@/lib/types'
import { Card, EducationBadge, EmploymentBadge, EmptyState, Pill, PageHeader, RegistrationBadge, SectionTitle, Badge } from '@/components/ui'
import RegistrationActions from './RegistrationActions'
import RegistrationQr from './RegistrationQr'

export const metadata = { title: 'Registrations' }
export const dynamic = 'force-dynamic'

export default async function RegistrationsPage() {
  await requireRole(['admin', 'encoder'])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pending_registrations')
    .select('id, first_name, middle_name, last_name, suffix, birthdate, sex, civil_status, purok_id, education_status, education_level, employment_status, skills, interests, civic_involvement, consent_version, consent_at, guardian_name, guardian_relationship, status, rejection_reason, created_at, puroks(name)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(friendlyError(error))
  const rows = (data ?? []) as unknown as PendingRegistration[]
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
