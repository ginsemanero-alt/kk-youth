import Link from 'next/link'
import { Archive, ChevronRight } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import type { YouthOverview } from '@/lib/types'
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui'
import PurgeCard from '../admin/audit/PurgeCard'

export const metadata = { title: 'Archive' }
export const dynamic = 'force-dynamic'

/**
 * Admin only: soft-deleted youth profiles. RLS shows deleted rows to Admins only, restoring is done on
 * the profile page (Admin only), and the permanent purge is the Admin-only purge_soft_deleted() RPC.
 */
export default async function ArchivePage() {
  await requireRole(['admin'], '/archive')
  const supabase = await createClient()
  const [{ data, error }, { data: note }] = await Promise.all([
    supabase.from('youth_overview').select('id, youth_code, full_name, purok_name, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(500),
    supabase.from('settings_note').select('retention_note').eq('id', 1).maybeSingle(),
  ])
  if (error) throw new Error(friendlyError(error))
  const rows = (data ?? []) as Pick<YouthOverview, 'id' | 'youth_code' | 'full_name' | 'purok_name' | 'deleted_at'>[]

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Archive" subtitle="Deleted youth profiles are kept here so mistakes can be undone. Open a profile to restore it. Only an Admin can see this page." />

      {rows.length === 0 ? (
        <EmptyState icon={Archive} title="No deleted profiles" hint="Profiles an Admin deletes from the registry appear here." />
      ) : (
        <ul className="stagger grid gap-3 md:grid-cols-2">
          {rows.map((y) => (
            <li key={y.id}>
              <Link href={`/youth/${y.id}`} className="group flex items-center justify-between gap-3 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className="min-w-0">
                  <span className="block truncate font-black">{y.full_name}</span>
                  <span className="block text-xs font-bold text-slate-400">{y.youth_code} / {y.purok_name} / deleted {formatDate(y.deleted_at)}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black text-slate-400 transition group-hover:bg-brand group-hover:text-white">
                  Open <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <SectionTitle sub="Permanent and cannot be undone. Recorded in the audit log.">Retention and permanent purge</SectionTitle>
        <p className="font-semibold text-slate-600">{note?.retention_note}</p>
        <PurgeCard />
      </Card>
    </div>
  )
}
