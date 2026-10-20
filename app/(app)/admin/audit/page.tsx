import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import type { AuditLog } from '@/lib/types'
import { Badge, Card, EmptyState, PageHeader, SectionTitle, chipCls, type Tone } from '@/components/ui'
import { ScrollText } from 'lucide-react'

export const metadata = { title: 'Audit log' }
export const dynamic = 'force-dynamic'

const ACTIONS = ['insert', 'update', 'delete', 'restore', 'view', 'export', 'approve', 'reject', 'purge', 'denied']
const TONE: Record<string, Tone> = { insert: 'green', update: 'blue', delete: 'red', restore: 'teal', view: 'amber', export: 'violet', approve: 'green', reject: 'rose', purge: 'ink', denied: 'red' }

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requireRole(['admin'], '/admin/audit')
  const { action } = await searchParams
  const supabase = await createClient()
  let q = supabase.from('audit_logs').select('*').order('id', { ascending: false }).limit(200)
  if (action && ACTIONS.includes(action)) q = q.eq('action', action)
  const [{ data, error }, { data: note }] = await Promise.all([q, supabase.from('settings_note').select('retention_note').eq('id', 1).maybeSingle()])
  if (error) throw new Error(friendlyError(error))
  const logs = (data ?? []) as AuditLog[]

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Accountability" title="Audit logs" subtitle="Who created, edited, deleted, viewed contact numbers of, or exported records, and who opened a page their role does not allow (denied). The log is append-only." />

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/audit" className={chipCls(!action)}>All</Link>
        {ACTIONS.map((a) => <Link key={a} href={`/admin/audit?action=${a}`} className={chipCls(action === a)}>{a}</Link>)}
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No log entries" />
      ) : (
        <div className="overflow-x-auto rounded-[3rem] bg-white shadow-sm ring-1 ring-black/5">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr className="border-b border-slate-100 text-xs font-black uppercase tracking-widest text-slate-400">
              <th className="px-8 py-5">When</th><th className="px-4 py-5">Who</th><th className="px-4 py-5">Action</th><th className="px-4 py-5">Table</th><th className="px-8 py-5">Details</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 align-top last:border-0">
                  <td className="whitespace-nowrap px-8 py-4 text-sm font-semibold text-slate-500">{formatDateTime(l.created_at)}</td>
                  <td className="px-4 py-4 text-sm font-black">{l.actor_name ?? 'unknown'}</td>
                  <td className="px-4 py-4"><Badge tone={TONE[l.action] ?? 'slate'}>{l.action}</Badge></td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-600">{l.table_name}</td>
                  <td className="max-w-md px-8 py-4">
                    <details>
                      <summary className="cursor-pointer text-sm font-black text-brand">View</summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                        {JSON.stringify({ record: l.record_id, before: l.old_data, after: l.new_data, detail: l.detail }, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card>
        <SectionTitle>Retention policy</SectionTitle>
        <p className="font-semibold text-slate-600">{note?.retention_note}</p>
        <Link href="/archive" className="mt-4 inline-flex font-black text-brand hover:underline">Deleted profiles and permanent purge are on the Archive page</Link>
      </Card>
    </div>
  )
}
