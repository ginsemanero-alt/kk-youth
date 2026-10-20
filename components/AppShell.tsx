'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Activity, BarChart3, ClipboardCheck, FileText, KeyRound, LifeBuoy, LogOut, MapPin, Menu, ScrollText, SlidersHorizontal, Upload, Users, UsersRound, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '@/lib/types'
import { RoleBadge } from '@/components/ui'
import { BrandMark, TriStripe } from '@/components/Logo'

interface Item { href: string; label: string; icon: LucideIcon; roles: Role[] }

const ALL: Role[] = ['admin', 'encoder', 'viewer']
const STAFF: Role[] = ['admin', 'encoder']

const ITEMS: Item[] = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3, roles: ALL },
  { href: '/youth', label: 'Youth registry', icon: Users, roles: ALL },
  { href: '/osy', label: 'Out-of-school youth', icon: LifeBuoy, roles: ALL },
  { href: '/activities', label: 'Activities', icon: Activity, roles: ALL },
  { href: '/reports', label: 'Reports', icon: FileText, roles: ALL },
  { href: '/registrations', label: 'Registrations', icon: ClipboardCheck, roles: STAFF },
  { href: '/import', label: 'Excel import', icon: Upload, roles: STAFF },
  { href: '/puroks', label: 'Puroks', icon: MapPin, roles: ['admin'] },
  { href: '/admin/form-settings', label: 'Form settings', icon: SlidersHorizontal, roles: ['admin'] },
  { href: '/admin/users', label: 'Users', icon: UsersRound, roles: ['admin'] },
  { href: '/admin/audit', label: 'Audit and data', icon: ScrollText, roles: ['admin'] },
]

export default function AppShell({ role, name, children }: { role: Role; name: string; children: React.ReactNode }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const items = ITEMS.filter((i) => i.roles.includes(role))

  const nav = (
    <nav aria-label="Main" className="stagger flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }, i) => {
        const active = path === href || (href !== '/dashboard' && path.startsWith(href + '/'))
        // Label the start of the Admin-only links.
        const adminOnly = (k: number) => items[k].roles.length === 1
        const firstAdmin = adminOnly(i) && i > 0 && !adminOnly(i - 1)
        return (
          <div key={href}>
            {firstAdmin && <div className="mb-2 mt-4 px-5 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Admin</div>}
            <Link
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-3 rounded-full px-5 py-2.5 text-sm font-black transition duration-200 ${
                active ? 'bg-sun text-ink shadow-lg shadow-black/20' : 'text-white/75 hover:translate-x-1 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-300 ${active ? 'bg-ink text-sun' : 'bg-white/10 text-white group-hover:scale-110 group-hover:bg-white/20'}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              {label}
            </Link>
          </div>
        )
      })}
    </nav>
  )

  const account = (
    <div className="mt-6 rounded-[2rem] bg-white/10 p-5 ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-sun to-amber-400 text-sm font-black text-ink shadow-md">
          {(name || 'A').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-white">{name || 'Account'}</div>
          <div className="mt-1"><RoleBadge role={role} /></div>
        </div>
      </div>
      <Link href="/account" onClick={() => setOpen(false)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-black text-white hover:bg-white/20">
        <KeyRound className="h-4 w-4" aria-hidden /> My account
      </Link>
      <form action="/auth/signout" method="post" className="mt-2">
        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-black text-white hover:bg-white/20">
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
      </form>
    </div>
  )

  const brand = (
    <Link href="/dashboard" className="block rounded-[2rem] px-1 py-1" aria-label="Dashboard">
      <BrandMark tone="light" size={48} />
    </Link>
  )

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print relative hidden w-72 shrink-0 flex-col overflow-hidden bg-linear-to-b from-ink via-ink to-brand-deep lg:sticky lg:top-0 lg:flex lg:h-screen">
        <TriStripe />
        <div className="pointer-events-none absolute -right-24 top-24 h-56 w-56 rounded-full bg-sun/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-1 flex-col overflow-y-auto p-6">
          {brand}
          <div className="mt-8 flex-1">{nav}</div>
          {account}
        </div>
      </aside>

      <header className="no-print sticky top-0 z-40 bg-ink lg:hidden">
        <TriStripe />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {brand}
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {open && (
        <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-linear-to-b from-ink via-ink to-brand-deep p-6">
            <div className="mb-6 flex items-center justify-between">
              {brand}
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1">{nav}</div>
            {account}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}


