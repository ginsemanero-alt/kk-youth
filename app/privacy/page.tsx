import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui'
import { CONSENT_VERSION } from '@/lib/constants'

export const metadata = { title: 'Privacy notice' }

const SECTIONS: { title: string; body: string[] }[] = [
  { title: 'What we collect', body: [
    'Name, birthdate, sex, civil status, purok or sitio, optional mobile number, educational status and level, employment status, skills, interests and civic involvement. For youth below 18, the name of a parent or guardian.',
    'We do not collect government ID numbers, addresses beyond the purok, photos, or social media accounts.' ] },
  { title: 'Why we collect it', body: [
    'To know who the youth of the barangay are, plan programs and activities, prepare the Comprehensive Barangay Youth Development Plan and SK reports, identify out-of-school youth who may need referrals, and track participation in SK activities.' ] },
  { title: 'Who can see it', body: [
    'Only signed-in SK staff. Admins have full access. Encoders can add and edit profiles. Viewers can read dashboards and reports but cannot see contact numbers. Access is enforced by the database, not only by the screens.' ] },
  { title: 'How it is protected', body: [
    'Mobile numbers are encrypted in the database and stored separately from the profile. Revealing a number is logged. Every creation, change, deletion and export is written to an audit log that cannot be edited. Consent scans are kept in a private storage bucket.' ] },
  { title: 'Consent', body: [
    `Your consent is recorded with the date and version of this notice (${CONSENT_VERSION}). Youth aged 15 to 17 need a parent or guardian to give consent as well.` ] },
  { title: 'How long we keep it', body: [
    'Active profiles are kept while you are within the youth age range and the SK needs them for planning. Deleted profiles are kept for 365 days so mistakes can be undone, then permanently removed. Audit logs are kept for three years.' ] },
  { title: 'Your rights', body: [
    'Under the Data Privacy Act of 2012 you may ask to see, correct, or delete your information, and to withdraw consent. Contact the SK Chairperson or Secretary of your barangay.' ] },
]

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Home</Link>
      <span className="block w-fit rounded-full bg-sun px-4 py-1.5 text-xs font-black uppercase tracking-widest">Privacy notice</span>
      <h1 className="mt-3 text-5xl font-black tracking-tight">How we handle your data</h1>
      <p className="mt-3 font-semibold text-slate-500">Version {CONSENT_VERSION}. Prepared under the Data Privacy Act of 2012 (RA 10173).</p>
      <div className="mt-8 space-y-5">
        {SECTIONS.map((s) => (
          <Card key={s.title} className="!p-8">
            <h2 className="text-2xl font-black">{s.title}</h2>
            {s.body.map((b) => <p key={b} className="mt-3 font-semibold text-slate-600">{b}</p>)}
          </Card>
        ))}
      </div>
    </main>
  )
}
