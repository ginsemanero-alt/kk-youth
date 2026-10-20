import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react'
import { canEdit, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AGE_BRACKETS, EDU_LEVEL_OPTIONS, EDU_STATUS_OPTIONS, EMPLOYMENT_OPTIONS, label } from '@/lib/constants'
import { likeSafe } from '@/lib/format'
import type { YouthOverview } from '@/lib/types'
import { Badge, EducationBadge, EmploymentBadge, EmptyState, PageHeader, btnPrimary, btnDark, inputCls } from '@/components/ui'

export const metadata = { title: 'Youth registry' }
const PAGE_SIZE = 20

type SP = { q?: string; purok?: string; bracket?: string; edu?: string; emp?: string; page?: string; deleted?: string }

export default async function YouthListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireRole(['admin', 'encoder'], '/youth')
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const supabase = await createClient()

  const { data: puroks } = await supabase.from('puroks').select('id, name').is('deleted_at', null).order('name')

  let query = supabase.from('youth_overview').select('*', { count: 'exact' })
  const showDeleted = sp.deleted === '1' && session.profile.role === 'admin'
  query = showDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  const q = likeSafe(sp.q ?? '')
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,youth_code.ilike.%${q}%`)
  if (sp.purok) query = query.eq('purok_id', sp.purok)
  if (sp.bracket) query = query.eq('age_bracket', sp.bracket)
  if (sp.edu) query = query.eq('education_status', sp.edu)
  if (sp.emp) query = query.eq('employment_status', sp.emp)
  const from = (page - 1) * PAGE_SIZE
  const { data, count, error } = await query.order('last_name').order('first_name').range(from, from + PAGE_SIZE - 1)
  const rows = (data ?? []) as YouthOverview[]
  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const href = (p: number) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) if (v && k !== 'page') u.set(k, v)
    if (p > 1) u.set('page', String(p))
    return `/youth${u.size ? `?${u}` : ''}`
  }

  return (
    <div>
      <PageHeader
        eyebrow="Registry"
        title={showDeleted ? 'Deleted profiles' : 'Youth registry'}
        subtitle={`${total} ${showDeleted ? 'deleted' : 'active'} profile${total === 1 ? '' : 's'}`}
        right={canEdit(session.profile.role) && <Link href="/youth/new" className={btnPrimary}><Plus className="h-4 w-4" /> Add youth</Link>}
      />

      <form method="get" className="mb-6 grid gap-3 rounded-[3rem] bg-white p-5 shadow-sm ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input name="q" defaultValue={sp.q ?? ''} placeholder="Search name or ID" aria-label="Search" className={`${inputCls} !pl-12`} />
        </div>
        <select name="purok" defaultValue={sp.purok ?? ''} aria-label="Purok" className={inputCls}>
          <option value="">All puroks</option>
          {(puroks ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="bracket" defaultValue={sp.bracket ?? ''} aria-label="Age bracket" className={inputCls}>
          <option value="">All ages</option>
          {AGE_BRACKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <select name="edu" defaultValue={sp.edu ?? ''} aria-label="Education" className={inputCls}>
          <option value="">All education</option>
          {EDU_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select name="emp" defaultValue={sp.emp ?? ''} aria-label="Employment" className={inputCls}>
          <option value="">All employment</option>
          {EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {showDeleted && <input type="hidden" name="deleted" value="1" />}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className={btnDark}>Apply filters</button>
          <Link href="/youth" className="inline-flex items-center rounded-full px-5 py-3 text-sm font-black text-slate-500 hover:text-ink">Clear</Link>
          {session.profile.role === 'admin' && (
            <Link href={showDeleted ? '/youth' : '/youth?deleted=1'} className="ml-auto inline-flex items-center rounded-full px-5 py-3 text-sm font-black text-slate-500 hover:text-ink">
              {showDeleted ? 'Show active' : 'Show deleted'}
            </Link>
          )}
        </div>
      </form>

      {error && <p role="alert" className="mb-4 font-bold text-rose-700">{error.message}</p>}

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No profiles found" hint="Try different filters, or add a new profile." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[3rem] bg-white shadow-sm ring-1 ring-black/5 md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-black uppercase tracking-widest text-slate-400">
                  <th className="px-8 py-5">Name</th><th className="px-4 py-5">Age</th><th className="px-4 py-5">Purok</th>
                  <th className="px-4 py-5">Education</th><th className="px-4 py-5">Employment</th><th className="px-8 py-5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((y) => (
                  // The name link stretches over the whole row (after:inset-0), so a click anywhere opens the profile.
                  <tr key={y.id} className="group relative cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-brand-soft/40">
                    <td className="px-8 py-4">
                      <Link href={`/youth/${y.id}`} className="font-black after:absolute after:inset-0 after:content-[''] group-hover:text-brand focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-4 focus-visible:after:ring-brand/30">{y.last_name}, {y.first_name}</Link>
                      <div className="text-xs font-bold text-slate-400">{y.youth_code}</div>
                    </td>
                    <td className="px-4 py-4 font-bold">{y.age} <span className="text-xs text-slate-400">({y.sex === 'male' ? 'M' : 'F'})</span></td>
                    <td className="px-4 py-4 font-semibold text-slate-600">{y.purok_name}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EducationBadge status={y.education_status} />
                        {y.education_level && <span className="text-xs font-bold text-slate-500">{label(EDU_LEVEL_OPTIONS, y.education_level)}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4"><EmploymentBadge status={y.employment_status} /></td>
                    <td className="px-8 py-4 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black text-slate-400 transition group-hover:bg-brand group-hover:text-white">
                        View <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {rows.map((y) => (
              <li key={y.id}>
                <Link href={`/youth/${y.id}`} className="block rounded-[2.5rem] bg-white p-6 shadow-sm ring-1 ring-black/5 active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-black leading-tight">{y.last_name}, {y.first_name}</div>
                      <div className="text-xs font-bold text-slate-400">{y.youth_code} / {y.age} yrs / {y.purok_name}</div>
                    </div>
                    {y.is_osy && <Badge tone="red">OSY</Badge>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <EducationBadge status={y.education_status} />
                    <EmploymentBadge status={y.employment_status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
            <Link aria-disabled={page <= 1} href={href(page - 1)} className={`inline-flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-sm font-black ring-1 ring-black/10 ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50'}`}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Link>
            <span className="text-sm font-black text-slate-500">Page {page} of {pages}</span>
            <Link aria-disabled={page >= pages} href={href(page + 1)} className={`inline-flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-sm font-black ring-1 ring-black/10 ${page >= pages ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50'}`}>
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </nav>
        </>
      )}
    </div>
  )
}
