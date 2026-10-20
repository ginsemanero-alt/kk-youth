import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileCheck2, LifeBuoy, Pencil, ShieldCheck } from 'lucide-react'
import { canEdit, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CIVIL_OPTIONS, EDU_LEVEL_OPTIONS, ACTIVITY_CATEGORIES, label } from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/format'
import type { YouthOverview } from '@/lib/types'
import { Alert, Badge, Card, EducationBadge, EmploymentBadge, Pill, SectionTitle, btnPrimary } from '@/components/ui'
import { ConsentScanUpload, ContactReveal, DeleteRestore } from './YouthActions'

export const metadata = { title: 'Youth profile' }

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-wider text-slate-400">{k}</dt>
      <dd className="mt-1 font-bold">{v || <span className="text-slate-300">Not provided</span>}</dd>
    </div>
  )
}

function Tags({ items }: { items: string[] }) {
  if (!items.length) return null
  return <div className="flex flex-wrap gap-1.5">{items.map((t) => <Pill key={t}>{t}</Pill>)}</div>
}

export default async function YouthDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(['admin', 'encoder', 'viewer'])
  const { id } = await params
  const role = session.profile.role
  const supabase = await createClient()

  const { data } = await supabase.from('youth_overview').select('*').eq('id', id).maybeSingle()
  const y = data as YouthOverview | null
  if (!y) notFound()

  const { data: attendance } = await supabase
    .from('attendance')
    .select('created_at, activities(title, activity_date, category)')
    .eq('youth_id', id)
    .order('created_at', { ascending: false })
  type Att = { created_at: string; activities: { title: string; activity_date: string; category: string } | null }
  const attended = (attendance ?? []) as unknown as Att[]

  let scanUrl: string | null = null
  if (y.consent_scan_path && canEdit(role)) {
    const { data: signed } = await supabase.storage.from('consent-scans').createSignedUrl(y.consent_scan_path, 600)
    scanUrl = signed?.signedUrl ?? null
  }

  return (
    <div className="space-y-6">
      <Link href="/youth" className="inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Registry</Link>

      {y.deleted_at && <Alert>This profile was deleted on {formatDate(y.deleted_at)}. Only an Admin can see and restore it.</Alert>}

      <Card className="relative overflow-hidden !bg-ink !text-white">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/60 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-block rounded-full bg-sun px-4 py-1.5 text-xs font-black uppercase tracking-widest text-ink">{y.youth_code}</span>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{y.full_name}</h1>
            <p className="mt-2 font-semibold text-white/70">{y.age} years old / {y.age_bracket} / {y.purok_name}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <EducationBadge status={y.education_status} />
              <EmploymentBadge status={y.employment_status} />
              {y.age < 18 && <Badge tone="sun">Minor</Badge>}
            </div>
          </div>
          {canEdit(role) && !y.deleted_at && (
            <Link href={`/youth/${y.id}/edit`} className={btnPrimary}><Pencil className="h-4 w-4" /> Edit</Link>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Profile</SectionTitle>
          <dl className="grid gap-5 sm:grid-cols-2">
            <Info k="Birthdate" v={formatDate(y.birthdate)} />
            <Info k="Sex" v={y.sex === 'male' ? 'Male' : 'Female'} />
            <Info k="Civil status" v={label(CIVIL_OPTIONS, y.civil_status)} />
            <Info k="Education level" v={label(EDU_LEVEL_OPTIONS, y.education_level)} />
            <Info k="Skills" v={<Tags items={y.skills} />} />
            <Info k="Interests" v={<Tags items={y.interests} />} />
            <div className="sm:col-span-2"><Info k="Civic involvement" v={<Tags items={y.civic_involvement} />} /></div>
          </dl>
          {canEdit(role) && (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <div className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Mobile number (encrypted)</div>
              <ContactReveal youthId={y.id} />
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle sub="Data Privacy Act of 2012">Consent</SectionTitle>
          <dl className="grid gap-5 sm:grid-cols-2">
            <Info k="Version" v={y.consent_version} />
            <Info k="Date" v={formatDateTime(y.consent_at)} />
            <Info k="Source" v={y.consent_source === 'self_registration' ? 'Self-registration' : y.consent_source === 'import' ? 'Excel import' : 'Signed form'} />
            {y.guardian_name && <Info k="Parent / guardian" v={`${y.guardian_name}${y.guardian_relationship ? ` (${y.guardian_relationship})` : ''}`} />}
          </dl>
          {canEdit(role) && (
            <div className="mt-6 space-y-3 border-t border-slate-100 pt-6">
              {scanUrl && (
                <a href={scanUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-black text-brand hover:underline">
                  <FileCheck2 className="h-5 w-5" /> View signed consent scan
                </a>
              )}
              {!y.deleted_at && <ConsentScanUpload youthId={y.id} hasScan={Boolean(y.consent_scan_path)} />}
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-400"><ShieldCheck className="h-4 w-4" /> Scans are in a private bucket. Links expire in 10 minutes.</p>
            </div>
          )}
        </Card>
      </div>

      {y.is_osy && (
        <Card className="!bg-red-50 ring-red-200">
          <SectionTitle sub="Informational suggestions based on age, level and employment">
            <span className="inline-flex items-center gap-2"><LifeBuoy className="h-6 w-6 text-flag" /> Out-of-school youth: suggested referrals</span>
          </SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {y.referrals.map((r) => (
              <li key={r} className="rounded-[2rem] bg-white p-5 text-sm font-bold ring-1 ring-red-100">{r}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle sub={`${attended.length} recorded`}>Activities attended</SectionTitle>
        {attended.length === 0 ? (
          <p className="font-semibold text-slate-500">No attendance recorded yet. This youth is on the not-yet-reached list.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {attended.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-black">{a.activities?.title}</span>
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  {label(ACTIVITY_CATEGORIES, a.activities?.category ?? 'other')} / {a.activities ? formatDate(a.activities.activity_date) : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {role === 'admin' && (
        <Card className="!p-8">
          <SectionTitle sub="Deleted profiles are kept for 365 days before they can be purged.">Danger zone</SectionTitle>
          <DeleteRestore youthId={y.id} deleted={Boolean(y.deleted_at)} />
        </Card>
      )}
    </div>
  )
}
