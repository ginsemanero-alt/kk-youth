import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadFormSettings } from '@/lib/formSettings'
import { PageHeader } from '@/components/ui'
import YouthForm from '@/components/YouthForm'
import type { YouthOverview, YouthSensitive } from '@/lib/types'
import { toYesNo, type ProfileValues } from '@/lib/validation'

export const metadata = { title: 'Edit youth' }

export default async function EditYouthPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin', 'encoder'])
  const { id } = await params
  const supabase = await createClient()
  const [{ data }, { data: sens }, { data: puroks }, settings] = await Promise.all([
    supabase.from('youth_overview').select('*').eq('id', id).maybeSingle(),
    supabase.from('youth_sensitive').select('*').eq('id', id).maybeSingle(),
    supabase.from('puroks').select('id, name').is('deleted_at', null).order('name'),
    loadFormSettings(supabase),
  ])
  const y = data as YouthOverview | null
  if (!y || y.deleted_at) notFound()
  const s = sens as YouthSensitive | null

  const initial: ProfileValues = {
    first_name: y.first_name, middle_name: y.middle_name ?? '', last_name: y.last_name, suffix: y.suffix ?? '',
    birthdate: y.birthdate, sex: y.sex, civil_status: y.civil_status ?? '', civil_status_other: y.civil_status_other ?? '',
    purok_id: y.purok_id, contact_number: '', email: y.email ?? '', registered_voter: toYesNo(y.registered_voter),
    religion: s?.religion ?? '',
    education_status: y.education_status, education_level: y.education_level ?? '', course: y.course ?? '',
    out_of_school_reason: y.out_of_school_reason ?? '',
    employment_status: y.employment_status ?? '', employment_sector: y.employment_sector ?? '',
    government_agency: y.government_agency ?? '', employment_duration: y.employment_duration ?? '',
    has_disability: toYesNo(s?.has_disability), disability_details: s?.disability_details ?? '',
    has_medical_condition: toYesNo(s?.has_medical_condition), medical_details: s?.medical_details ?? '',
    youth_org_member: toYesNo(y.youth_org_member), youth_org_name: y.youth_org_name ?? '',
    skills: y.skills, interests: y.interests, civic_involvement: y.civic_involvement,
    guardian_name: y.guardian_name ?? '', guardian_relationship: y.guardian_relationship ?? '',
  }
  return (
    <div>
      <PageHeader eyebrow={y.youth_code} title={`Edit ${y.full_name}`} />
      <YouthForm mode="edit" youthId={y.id} youthCode={y.youth_code} consentVersion={y.consent_version} puroks={puroks ?? []} settings={settings} initial={initial} />
    </div>
  )
}
