import Image from 'next/image'
import logo from '@/assets/sk-logo-round.png'
import { ORG } from '@/lib/constants'

/** The SK Barangay Bubog seal, always round with a white ring so it reads on dark and light backgrounds. */
export function Logo({ size = 44, className = '', preload = false, eager = false }: {
  size?: number
  className?: string
  preload?: boolean
  /** Load right away even while hidden (for print-only content). */
  eager?: boolean
}) {
  return (
    <Image
      src={logo}
      alt={`${ORG.short} logo`}
      width={size}
      height={size}
      preload={preload}
      loading={eager ? 'eager' : undefined}
      className={`shrink-0 rounded-full bg-white shadow-md ring-2 ring-white ${className}`}
    />
  )
}

/** Logo plus the organization name, used in headers. */
export function BrandMark({ tone = 'light', size = 44, preload = false }: { tone?: 'light' | 'dark'; size?: number; preload?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Logo size={size} preload={preload} />
      <span className="min-w-0 leading-tight">
        <span className={`block truncate text-base font-black ${tone === 'light' ? 'text-white' : 'text-ink'}`}>{ORG.short}</span>
        <span className={`block truncate text-[11px] font-bold uppercase tracking-widest ${tone === 'light' ? 'text-white/60' : 'text-slate-500'}`}>KK Youth Profiling</span>
      </span>
    </span>
  )
}

/** Blue, yellow and red stripe taken from the logo. */
export function TriStripe({ className = 'h-1.5' }: { className?: string }) {
  return <div aria-hidden className={`bg-linear-to-r from-brand via-sun to-flag ${className}`} />
}
