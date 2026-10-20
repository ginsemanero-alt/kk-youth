import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox, TriangleAlert, CircleCheck, Info } from 'lucide-react'
import type { EducationStatus, EmploymentStatus, RegistrationStatus, Role } from '@/lib/types'

// ---------- class tokens ----------
const btn = 'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'
export const btnPrimary = `${btn} bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand-deep`
export const btnDark = `${btn} bg-ink text-white hover:bg-brand-deep`
export const btnSun = `${btn} bg-sun text-ink hover:brightness-95`
export const btnGhost = `${btn} bg-white text-ink ring-1 ring-black/10 hover:bg-slate-50`
export const btnDanger = `${btn} bg-flag text-white hover:brightness-110`
export const inputCls =
  'w-full rounded-full border-2 border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 disabled:bg-slate-100'
export const textareaCls =
  'w-full rounded-[2rem] border-2 border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15'
export const chipCls = (active: boolean) =>
  `inline-flex items-center rounded-full px-4 py-2 text-sm font-black transition active:scale-95 ${
    active ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-black/10 hover:bg-slate-50'
  }`

// ---------- layout atoms ----------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[3.5rem] bg-white p-8 shadow-sm ring-1 ring-black/5 sm:p-10 ${className}`}>{children}</div>
}

export function PageHeader({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <span className="inline-block rounded-full bg-sun px-4 py-1.5 text-xs font-black uppercase tracking-widest text-ink">{eyebrow}</span>
        )}
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl font-semibold text-slate-500">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap gap-2">{right}</div>}
    </div>
  )
}

export function StatCard({ label, value, sub, tone = 'bg-white text-ink', icon: Icon }: {
  label: string; value: ReactNode; sub?: string; tone?: string; icon?: LucideIcon
}) {
  return (
    <div className={`rounded-[3.5rem] p-8 shadow-sm ring-1 ring-black/5 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-widest opacity-70">{label}</span>
        {Icon && <Icon className="h-5 w-5 opacity-70" aria-hidden />}
      </div>
      <div className="mt-3 text-5xl font-black tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-sm font-bold opacity-70">{sub}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, hint, action }: { icon?: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-[3.5rem] border-2 border-dashed border-slate-300 bg-white/60 px-8 py-14 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon className="h-8 w-8" aria-hidden />
      </span>
      <h3 className="mt-5 text-2xl font-black">{title}</h3>
      {hint && <p className="mx-auto mt-2 max-w-md font-semibold text-slate-500">{hint}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const map = {
    error: { cls: 'bg-rose-50 text-rose-700 ring-rose-200', Icon: TriangleAlert },
    success: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: CircleCheck },
    info: { cls: 'bg-brand-soft text-brand-deep ring-blue-200', Icon: Info },
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-[2rem] px-6 py-4 text-sm font-bold ring-1 ${map.cls}`}>
      <map.Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-2">
        <label htmlFor={htmlFor} className="text-xs font-black uppercase tracking-wider text-slate-600">{label}</label>
        {hint && <span className="text-xs font-semibold text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-black tracking-tight">{children}</h2>
      {sub && <p className="text-sm font-semibold text-slate-500">{sub}</p>}
    </div>
  )
}

// ---------- badges ----------
const TONES = {
  blue: 'bg-brand text-white',
  sky: 'bg-sky-500 text-white',
  red: 'bg-flag text-white',
  green: 'bg-emerald-600 text-white',
  teal: 'bg-teal-600 text-white',
  amber: 'bg-amber-400 text-amber-950',
  sun: 'bg-sun text-ink',
  rose: 'bg-rose-100 text-rose-700',
  slate: 'bg-slate-200 text-slate-700',
  ink: 'bg-ink text-white',
  violet: 'bg-violet-600 text-white',
} as const
export type Tone = keyof typeof TONES

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-wider ${TONES[tone]}`}>
      {children}
    </span>
  )
}

export function EducationBadge({ status }: { status: EducationStatus }) {
  if (status === 'in_school') return <Badge tone="sky">In-School</Badge>
  if (status === 'graduated') return <Badge tone="green">Graduated</Badge>
  return <Badge tone="red">OSY</Badge>
}

export function EmploymentBadge({ status }: { status: EmploymentStatus | null }) {
  if (status === 'employed') return <Badge tone="green">Employed</Badge>
  if (status === 'self_employed') return <Badge tone="teal">Self-employed</Badge>
  if (status === 'unemployed') return <Badge tone="amber">Unemployed</Badge>
  return <Badge tone="slate">Work: not specified</Badge>
}

export function RegistrationBadge({ status }: { status: RegistrationStatus }) {
  if (status === 'approved') return <Badge tone="green">Approved</Badge>
  if (status === 'rejected') return <Badge tone="rose">Rejected</Badge>
  return <Badge tone="amber">Pending</Badge>
}

export function RoleBadge({ role }: { role: Role }) {
  if (role === 'admin') return <Badge tone="ink">Admin</Badge>
  if (role === 'encoder') return <Badge tone="blue">Encoder</Badge>
  return <Badge tone="slate">Viewer</Badge>
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand-deep">{children}</span>
}

export function ProgressBarPublic({ value, tone = 'bg-brand' }: { value: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ---------- loading placeholders ----------
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-full bg-slate-200 ${className}`} />
}

export function CardSkeleton({ className = '', rows = 3 }: { className?: string; rows?: number }) {
  return (
    <div className={`rounded-[3.5rem] bg-white p-8 shadow-sm ring-1 ring-black/5 sm:p-10 ${className}`} aria-hidden>
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={`h-4 ${i % 2 ? 'w-2/3' : 'w-full'}`} />)}
      </div>
    </div>
  )
}

/** Generic page-level loading state (used by loading.tsx files). */
export function PageSkeleton({ stats = 0, cards = 1 }: { stats?: number; cards?: number }) {
  return (
    <div role="status" aria-label="Loading" aria-busy="true">
      <div className="mb-8">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-4 h-12 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      {stats > 0 && (
        <div className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: stats }, (_, i) => <CardSkeleton key={i} rows={1} />)}
        </div>
      )}
      <div className="space-y-6">
        {Array.from({ length: cards }, (_, i) => <CardSkeleton key={i} rows={5} />)}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}
