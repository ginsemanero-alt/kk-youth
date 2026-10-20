import Link from 'next/link'
import {
  Activity, ArrowRight, BadgeCheck, BarChart3, ClipboardCheck, FileSpreadsheet, Fingerprint, LifeBuoy, Lock, QrCode, ScrollText, ShieldCheck,
  Sparkles, UserPlus, Users,
} from 'lucide-react'
import { BrandMark, Logo, TriStripe } from '@/components/Logo'
import Reveal from '@/components/Reveal'
import { ORG } from '@/lib/constants'

const MODULES = [
  { icon: Users, title: 'Youth registry', text: 'One profile per youth with automatic age brackets and duplicate detection.', chip: 'bg-brand text-white' },
  { icon: BarChart3, title: 'Live analytics', text: 'Age, education, employment and purok breakdowns computed in the database.', chip: 'bg-sun text-ink' },
  { icon: Activity, title: 'Activity tracking', text: 'Attendance per event, participation rate, and youth not yet reached.', chip: 'bg-grape text-white' },
  { icon: QrCode, title: 'Self-registration', text: 'Share a link or QR code. Encoders approve before anything enters the registry.', chip: 'bg-ink text-sun' },
  { icon: FileSpreadsheet, title: 'Reports and import', text: 'Filter, then export to PDF or Excel. Bring old Excel records in with validation.', chip: 'bg-emerald-600 text-white' },
  { icon: LifeBuoy, title: 'OSY referrals', text: 'Out-of-school youth are flagged with suggested TESDA, ALS and job program referrals.', chip: 'bg-flag text-white' },
]

const STEPS = [
  { icon: UserPlus, title: 'Register', text: 'Fill out the youth profile online or scan the QR code at the barangay hall.' },
  { icon: BadgeCheck, title: 'SK reviews', text: 'An SK encoder checks your answers before you are added to the registry.' },
  { icon: Sparkles, title: 'You are counted', text: 'Programs, trainings and activities are planned with you in mind.' },
]

const SAFEGUARDS = [
  { icon: ShieldCheck, text: 'Row Level Security on every table. Roles are read from the database, never from the browser.' },
  { icon: Lock, text: 'Contact numbers are encrypted at rest and shown only on request.' },
  { icon: Fingerprint, text: 'Consent is recorded with a timestamp and version. Guardian consent for ages 15 to 17.' },
  { icon: ScrollText, text: 'Every create, edit, delete, view of contact and export is written to an audit log.' },
]

const CHIPS = [
  { text: 'Ages 15 to 30', cls: 'left-0 top-6 sm:-left-6', delay: '0s' },
  { text: 'Secure and private', cls: 'right-0 top-1/2 sm:-right-8', delay: '1.5s' },
  { text: 'Register by QR', cls: 'bottom-4 left-4 sm:-left-2', delay: '3s' },
]

export default function Home() {
  return (
    <div className="overflow-x-hidden">
      <header className="absolute inset-x-0 top-0 z-20">
        <TriStripe />
        <div className="mx-auto flex max-w-6xl animate-rise items-center justify-between gap-3 px-4 py-5 sm:px-8">
          <BrandMark tone="light" size={46} preload />
          <nav className="flex shrink-0 items-center gap-2">
            <Link href="/privacy" className="hidden rounded-full px-4 py-2 text-sm font-black text-white/80 transition hover:text-white sm:block">Privacy</Link>
            <Link href="/login" className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-black text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20">Staff sign in</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-ink px-4 pb-40 pt-32 text-white sm:px-8 lg:pt-40">
        <div className="absolute -right-40 -top-40 -z-10 h-[34rem] w-[34rem] animate-drift rounded-full bg-brand/70 blur-3xl" aria-hidden />
        <div className="absolute -bottom-48 left-[10%] -z-10 h-[30rem] w-[30rem] animate-drift rounded-full bg-flag/35 blur-3xl [animation-delay:-6s]" aria-hidden />
        <div className="absolute right-1/3 top-1/3 -z-10 h-72 w-72 animate-drift rounded-full bg-sun/20 blur-3xl [animation-delay:-12s]" aria-hidden />
        <div
          className="absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]"
          aria-hidden
        />

        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="stagger">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-sun ring-1 ring-white/15 backdrop-blur">
              <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-sun" /><span className="relative h-2 w-2 rounded-full bg-sun" /></span>
              {ORG.sk}
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl">
              Every young person counted. Every program{' '}
              <span className="bg-linear-to-r from-sun via-amber-300 to-sun bg-[length:200%_100%] bg-clip-text text-transparent animate-gradient">aimed right.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-semibold text-white/70">
              The Katipunan ng Kabataan profiling system of {ORG.barangay}. One secure registry for youth aged 15 to 30, for better SK programs.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/register" className="shine group inline-flex items-center gap-2 rounded-full bg-sun px-8 py-4 text-base font-black text-ink shadow-xl shadow-sun/30 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sun/40 active:scale-95">
                I am a youth, register me <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-8 py-4 text-base font-black text-white ring-1 ring-white/25 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 active:scale-95">
                SK staff sign in
              </Link>
            </div>
          </div>

          <div className="relative order-first mx-auto w-52 animate-pop sm:w-72 lg:order-none lg:w-full lg:max-w-sm">
            <div className="absolute inset-0 scale-125 rounded-full bg-sun/25 blur-3xl" aria-hidden />
            <div className="relative animate-float">
              <div className="tri-ring absolute -inset-3 animate-spin-slow rounded-full opacity-90 sm:-inset-4" aria-hidden />
              <div className="absolute -inset-1 rounded-full bg-ink sm:-inset-1.5" aria-hidden />
              <Logo size={420} preload className="relative h-auto w-full !ring-4 !ring-white shadow-2xl" />
            </div>
            {CHIPS.map((c) => (
              <span
                key={c.text}
                className={`absolute hidden animate-float items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-black text-ink shadow-xl sm:inline-flex ${c.cls}`}
                style={{ animationDelay: c.delay }}
              >
                <span className="h-2 w-2 rounded-full bg-linear-to-r from-brand to-flag" aria-hidden />{c.text}
              </span>
            ))}
          </div>
        </div>

        {/* Wave into the page */}
        <svg className="absolute inset-x-0 bottom-0 -z-10 h-24 w-full text-paper sm:h-32" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0,64 C240,120 480,0 720,48 C960,96 1200,24 1440,72 L1440,120 L0,120 Z" />
        </svg>
      </section>

      {/* Stats strip over the wave */}
      <div className="relative z-10 mx-auto -mt-24 max-w-5xl px-4 sm:px-8">
        <dl className="grid grid-cols-3 divide-x divide-slate-100 rounded-[2.5rem] bg-white p-2 shadow-[0_24px_60px_-20px_rgb(11_18_56/0.35)] ring-1 ring-black/5 animate-rise [animation-delay:300ms]">
          {[['15 to 30', 'Age coverage', 'text-brand'], ['3 roles', 'Admin, Encoder, Viewer', 'text-flag'], ['RA 10173', 'Privacy-aware', 'text-grape']].map(([v, l, c]) => (
            <div key={l} className="px-3 py-4 text-center sm:px-6 sm:py-6">
              <dd className={`text-xl font-black sm:text-4xl ${c}`}>{v}</dd>
              <dt className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:text-xs">{l}</dt>
            </div>
          ))}
        </dl>
      </div>

      {/* Modules */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
        <Reveal className="max-w-2xl">
          <span className="text-sm font-black uppercase tracking-widest text-brand">What it does</span>
          <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Everything the SK needs, in one place</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icon, title, text, chip }, i) => (
            <Reveal key={title} as="article" delay={i * 80} className="group relative overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-[0_1px_2px_rgb(11_18_56/0.04),0_12px_32px_-12px_rgb(11_18_56/0.12)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-2 hover:shadow-[0_30px_60px_-20px_rgb(11_18_56/0.3)]">
              <div className={`absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-10 blur-2xl transition duration-500 group-hover:scale-150 group-hover:opacity-25 ${chip}`} aria-hidden />
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition duration-300 group-hover:-rotate-6 group-hover:scale-110 ${chip}`}>
                <Icon className="h-7 w-7" aria-hidden />
              </span>
              <h3 className="mt-6 text-2xl font-black">{title}</h3>
              <p className="mt-2 font-semibold text-slate-500">{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative isolate overflow-hidden bg-ink px-4 py-24 text-white sm:px-8">
        <div className="absolute -left-32 top-0 -z-10 h-96 w-96 animate-drift rounded-full bg-brand/50 blur-3xl" aria-hidden />
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center">
            <span className="text-sm font-black uppercase tracking-widest text-sun">For the youth</span>
            <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Three steps to be counted</h2>
          </Reveal>
          <div className="relative mt-14">
          <div className="absolute left-[16%] right-[16%] top-10 hidden h-0.5 bg-linear-to-r from-brand via-sun to-flag md:block" aria-hidden />
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} as="li" delay={i * 150} className="relative text-center">
                <span className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-ink shadow-xl ring-8 ring-ink">
                  <Icon className="h-8 w-8" aria-hidden />
                  <span className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-sun text-sm font-black text-ink">{i + 1}</span>
                </span>
                <h3 className="mt-5 text-2xl font-black">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs font-semibold text-white/65">{text}</p>
              </Reveal>
            ))}
          </ol>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="px-4 py-24 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <span className="inline-block rounded-full bg-brand-soft px-4 py-1.5 text-xs font-black uppercase tracking-widest text-brand-deep">Data privacy</span>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Built so a panel, and a parent, can trust it</h2>
            <p className="mt-4 font-semibold text-slate-600">Youth data is personal data. The system collects only what planning needs and protects it at the database level, not just in the interface.</p>
            <Link href="/privacy" className="group mt-6 inline-flex items-center gap-2 font-black text-brand">
              Read the privacy notice <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
            </Link>
          </Reveal>
          <ul className="grid gap-4">
            {SAFEGUARDS.map(({ icon: Icon, text }, i) => (
              <Reveal key={text} as="li" delay={i * 100} className="group flex items-start gap-4 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 transition duration-300 hover:translate-x-1 hover:shadow-lg">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-sun transition group-hover:bg-brand"><Icon className="h-6 w-6" aria-hidden /></span>
                <p className="pt-1 font-bold text-slate-700">{text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
        <Reveal className="relative isolate overflow-hidden rounded-[3.5rem] bg-linear-to-r from-brand via-brand-deep to-grape bg-[length:200%_100%] p-10 text-white shadow-2xl shadow-brand/30 animate-gradient sm:p-16">
          <div className="absolute -right-10 -top-10 -z-10 h-56 w-56 rounded-full bg-sun/30 blur-3xl" aria-hidden />
          <div className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
            <div>
              <ClipboardCheck className="h-10 w-10 text-sun" aria-hidden />
              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Are you between 15 and 30?</h2>
              <p className="mt-3 max-w-xl font-semibold text-white/80">Fill out the short form. An SK encoder will review it before your profile is added.</p>
              <Link href="/register" className="shine group mt-8 inline-flex items-center gap-2 rounded-full bg-sun px-8 py-4 font-black text-ink shadow-xl shadow-black/20 transition hover:-translate-y-0.5 active:scale-95">
                Register now <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
            <div className="hidden animate-float md:block"><Logo size={180} className="!ring-4" /></div>
          </div>
        </Reveal>
      </section>

      <footer className="bg-ink text-white">
        <TriStripe />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
          <BrandMark tone="light" size={44} />
          <p className="text-sm font-semibold text-white/60">
            {ORG.sk}. Academic capstone project (BSIT). <Link href="/privacy" className="font-black text-white underline">Privacy notice</Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
