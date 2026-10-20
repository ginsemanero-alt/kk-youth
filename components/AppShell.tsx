'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Activity, BarChart3, ClipboardCheck, FileText, KeyRound, LifeBuoy, LogOut, MapPin, Menu, ScrollText, ShieldCheck, Upload, Users, UsersRound, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '@/lib/types'
import { RoleBadge } from '@/components/ui'

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
  { href: '/admin/users', label: 'Users', icon: UsersRound, roles: ['admin'] },
  { href: '/admin/audit', label: 'Audit and data', icon: ScrollText, roles: ['admin'] },
]

export default function AppShell({ role, name, children }: { role: Role; name: string; children: React.ReactNode }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const items = ITEMS.filter((i) => i.roles.includes(role))

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href || (href !== '/dashboard' && path.startsWith(href + '/'))
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-full px-5 py-3 text-sm font-black transition ${
              active ? 'bg-sun text-ink shadow-lg' : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  const account = (
    <div className="mt-6 rounded-[2rem] bg-white/10 p-5">
      <div className="truncate text-sm font-black text-white">{name || 'Account'}</div>
      <div className="mt-2"><RoleBadge role={role} /></div>
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
    <Link href="/dashboard" className="flex items-center gap-3 px-2">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sun text-ink"><ShieldCheck className="h-6 w-6" aria-hidden /></span>
      <span className="leading-tight">
        <span className="block text-lg font-black text-white">KK Youth</span>
        <span className="block text-[11px] font-bold uppercase tracking-widest text-white/60">Profiling System</span>
      </span>
    </Link>
  )

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print hidden w-72 shrink-0 flex-col bg-ink p-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">
        {brand}
        <div className="mt-8 flex-1">{nav}</div>
        {account}
      </aside>

      <header className="no-print sticky top-0 z-40 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        {brand}
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {open && (
        <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-ink p-6">
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


