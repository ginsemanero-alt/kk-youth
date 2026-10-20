import Link from 'next/link'
import {
  Activity, ArrowRight, BarChart3, ClipboardCheck, FileSpreadsheet, Fingerprint, LifeBuoy, Lock, QrCode, ScrollText, ShieldCheck, Users,
} from 'lucide-react'
import { BrandMark, Logo, TriStripe } from '@/components/Logo'
import { ORG } from '@/lib/constants'

const MODULES = [
  { icon: Users, title: 'Youth registry', text: 'One profile per youth with automatic age brackets and duplicate detection.', tone: 'bg-brand text-white' },
  { icon: BarChart3, title: 'Live analytics', text: 'Age, education, employment and purok breakdowns computed in the database.', tone: 'bg-sun text-ink' },
  { icon: Activity, title: 'Activity tracking', text: 'Attendance per event, participation rate, and youth not yet reached.', tone: 'bg-white text-ink' },
  { icon: QrCode, title: 'Self-registration', text: 'Share a link or QR code. Encoders approve before anything enters the registry.', tone: 'bg-ink text-white' },
  { icon: FileSpreadsheet, title: 'Reports and import', text: 'Filter, then export to PDF or Excel. Bring old Excel records in with validation.', tone: 'bg-white text-ink' },
  { icon: LifeBuoy, title: 'OSY referrals', text: 'Out-of-school youth are flagged with suggested TESDA, ALS and job program referrals.', tone: 'bg-flag text-white' },
]

const SAFEGUARDS = [
  { icon: ShieldCheck, text: 'Row Level Security on every table. Roles are read from the database, never from the browser.' },
  { icon: Lock, text: 'Contact numbers are encrypted at rest and shown only on request.' },
  { icon: Fingerprint, text: 'Consent is recorded with a timestamp and version. Guardian consent for ages 15 to 17.' },
  { icon: ScrollText, text: 'Every create, edit, delete, view of contact and export is written to an audit log.' },
]

export default function Home() {
  return (
    <div>
      <header className="absolute inset-x-0 top-0 z-10">
        <TriStripe />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
          <BrandMark tone="light" size={46} preload />
          <nav className="flex shrink-0 items-center gap-2">
            <Link href="/privacy" className="hidden rounded-full px-4 py-2 text-sm font-black text-white/80 hover:text-white sm:block">Privacy</Link>
            <Link href="/login" className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-black text-white ring-1 ring-white/20 hover:bg-white/20">Staff sign in</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-linear-to-br from-ink via-ink to-brand-deep px-4 pb-24 pt-32 text-white sm:px-8 lg:pt-36">
        <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand/60 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 left-1/4 h-[26rem] w-[26rem] rounded-full bg-flag/25 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
          <div>
            <span className="inline-block rounded-full bg-sun px-4 py-1.5 text-xs font-black uppercase tracking-widest text-ink">{ORG.sk}</span>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl">
              Every young person counted. Every program <span className="text-sun">aimed right.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold text-white/75">
              The Katipunan ng Kabataan profiling system of {ORG.barangay}. One secure registry for youth aged 15 to 30 that feeds the Comprehensive Barangay Youth Development Plan.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-sun px-8 py-4 text-base font-black text-ink shadow-xl shadow-sun/20 transition hover:brightness-95 active:scale-95">
                I am a youth, register me <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-8 py-4 text-base font-black text-white ring-1 ring-white/25 transition hover:bg-white/20 active:scale-95">
                SK staff sign in
              </Link>
            </div>
          </div>
          <div className="relative order-first mx-auto w-40 sm:w-60 lg:order-none lg:w-full lg:max-w-sm">
            <div className="absolute inset-0 scale-110 rounded-full bg-sun/30 blur-3xl" aria-hidden />
            <Logo size={420} preload className="relative h-auto w-full !ring-8 !ring-white/90 shadow-2xl" />
          </div>
        </div>
        <dl className="relative mx-auto mt-16 grid max-w-6xl grid-cols-3 gap-3 sm:gap-4">
          {[['15 to 30', 'Age coverage'], ['3 roles', 'Admin, Encoder, Viewer'], ['RA 10173', 'Privacy-aware']].map(([v, l]) => (
            <div key={l} className="rounded-[2rem] bg-white/10 p-4 ring-1 ring-white/10 backdrop-blur sm:p-5">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-white/60 sm:text-xs">{l}</dt>
              <dd className="mt-1 text-xl font-black sm:text-3xl">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <TriStripe className="h-2" />

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
        <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Everything the SK needs, in one place</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icon, title, text, tone }) => (
            <article key={title} className={`rounded-[3.5rem] p-9 shadow-sm ring-1 ring-black/5 ${tone}`}>
              <Icon className="h-9 w-9" aria-hidden />
              <h3 className="mt-6 text-2xl font-black">{title}</h3>
              <p className="mt-2 font-semibold opacity-80">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-24 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-block rounded-full bg-brand-soft px-4 py-1.5 text-xs font-black uppercase tracking-widest text-brand-deep">Data privacy</span>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Built so a panel, and a parent, can trust it</h2>
            <p className="mt-4 font-semibold text-slate-600">Youth data is personal data. The system collects only what planning needs and protects it at the database level, not just in the interface.</p>
            <Link href="/privacy" className="mt-6 inline-flex items-center gap-2 font-black text-brand hover:underline">Read the privacy notice <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <ul className="grid gap-4">
            {SAFEGUARDS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-4 rounded-[2.5rem] bg-paper p-6 ring-1 ring-black/5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-sun"><Icon className="h-6 w-6" aria-hidden /></span>
                <p className="pt-1 font-bold text-slate-700">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <div className="relative isolate overflow-hidden rounded-[3.5rem] bg-linear-to-br from-brand to-brand-deep p-10 text-white sm:p-16">
          <div className="absolute -right-10 -top-10 -z-10 h-48 w-48 rounded-full bg-sun/25 blur-2xl" aria-hidden />
          <ClipboardCheck className="h-10 w-10 text-sun" aria-hidden />
          <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Are you between 15 and 30?</h2>
          <p className="mt-3 max-w-xl font-semibold text-white/80">Fill out the short form. An SK encoder will review it before your profile is added.</p>
          <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-full bg-sun px-8 py-4 font-black text-ink transition hover:brightness-95 active:scale-95">
            Register now <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="bg-ink px-4 py-10 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <BrandMark tone="light" size={44} />
          <p className="text-sm font-semibold text-white/60">
            {ORG.sk}. Academic capstone project (BSIT). <Link href="/privacy" className="font-black text-white underline">Privacy notice</Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
