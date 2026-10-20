import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import YouthForm from '@/components/YouthForm'
import type { YouthOverview } from '@/lib/types'
import type { ProfileValues } from '@/lib/validation'

export const metadata = { title: 'Edit youth' }

export default async function EditYouthPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin', 'encoder'])
  const { id } = await params
  const supabase = await createClient()
  const [{ data }, { data: puroks }] = await Promise.all([
    supabase.from('youth_overview').select('*').eq('id', id).maybeSingle(),
    supabase.from('puroks').select('id, name').is('deleted_at', null).order('name'),
  ])
  const y = data as YouthOverview | null
  if (!y || y.deleted_at) notFound()

  const initial: ProfileValues = {
    first_name: y.first_name, middle_name: y.middle_name ?? '', last_name: y.last_name, suffix: y.suffix ?? '',
    birthdate: y.birthdate, sex: y.sex, civil_status: y.civil_status, purok_id: y.purok_id, contact_number: '',
    education_status: y.education_status, education_level: y.education_level ?? '', employment_status: y.employment_status,
    skills: y.skills, interests: y.interests, civic_involvement: y.civic_involvement,
    guardian_name: y.guardian_name ?? '', guardian_relationship: y.guardian_relationship ?? '',
  }
  return (
    <div>
      <PageHeader eyebrow={y.youth_code} title={`Edit ${y.full_name}`} />
      <YouthForm mode="edit" youthId={y.id} puroks={puroks ?? []} initial={initial} />
    </div>
  )
}
