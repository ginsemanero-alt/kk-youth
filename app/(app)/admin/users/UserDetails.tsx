'use client'
import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore, CalendarClock, ClipboardCheck, ClipboardX, FileDown, KeyRound, Loader2, LogIn, Mail, Pencil, Trash2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/Modal'
import { ROLE_OPTIONS } from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/format'
import type { Profile } from '@/lib/types'
import { Badge, RoleBadge, btnDark, btnGhost, type Tone } from '@/components/ui'

interface Activity { id: number; action: string; table_name: string; created_at: string; detail: Record<string, unknown> | null }
interface Stats { youth: number; approved: number; rejected: number; exports: number; recent: Activity[] }

const TONE: Record<string, Tone> = { insert: 'green', update: 'blue', delete: 'red', restore: 'teal', view: 'amber', export: 'violet', approve: 'green', reject: 'rose', purge: 'ink' }
const TABLE: Record<string, string> = {
  youth: 'youth profile', youth_contacts: 'mobile number', pending_registrations: 'registration', puroks: 'purok', activities: 'activity',
  attendance: 'attendance', profiles: 'user account', form_fields: 'form setting', custom_questions: 'question', youth_overview: 'report',
  youth_sensitive: 'sensitive data', youth_custom_answers: 'question answers',
}
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

/** Admin-only panel with one staff account's details, work counts and latest audit entries. */
export default function UserDetails({ user, email, lastSignIn, isMe, serviceKeySet, onClose, onRename, onReset, onArchive, onRestore, onDelete }: {
  user: Profile
  email?: string
  lastSignIn?: string
  isMe: boolean
  serviceKeySet: boolean
  onClose: () => void
  onRename: () => void
  onReset: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const count = (action: string) =>
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('actor_id', user.id).eq('action', action)
      const [youth, approved, rejected, exports, recent] = await Promise.all([
        supabase.from('youth').select('id', { count: 'exact', head: true }).eq('created_by', user.id),
        count('approve'), count('reject'), count('export'),
        supabase.from('audit_logs').select('id, action, table_name, created_at, detail').eq('actor_id', user.id).order('id', { ascending: false }).limit(10),
      ])
      if (cancelled) return
      if (youth.error || recent.error) { setFailed(true); return }
      setStats({
        youth: youth.count ?? 0, approved: approved.count ?? 0, rejected: rejected.count ?? 0, exports: exports.count ?? 0,
        recent: (recent.data ?? []) as Activity[],
      })
    })()
    return () => { cancelled = true }
  }, [user.id])

  const status = user.archived_at ? <Badge tone="ink">Archived</Badge> : user.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="rose">Deactivated</Badge>
  const tiles = stats && [
    { icon: UserPlus, label: 'Youth profiles added', value: stats.youth, tone: 'bg-brand text-white' },
    { icon: ClipboardCheck, label: 'Registrations approved', value: stats.approved, tone: 'bg-emerald-600 text-white' },
    { icon: ClipboardX, label: 'Registrations rejected', value: stats.rejected, tone: 'bg-flag text-white' },
    { icon: FileDown, label: 'Reports exported', value: stats.exports, tone: 'bg-grape text-white' },
  ]

  return (
    <Modal title="User details" onClose={onClose} wide>
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-ink to-brand text-xl font-black text-white shadow-lg">{initials(user.full_name || email || '?')}</span>
        <div className="min-w-0">
          <h3 className="truncate text-2xl font-black">{user.full_name || 'Unnamed'}{isMe && <span className="ml-2 text-sm font-bold text-slate-400">(you)</span>}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5"><RoleBadge role={user.role} />{status}</div>
        </div>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          { icon: Mail, k: 'Email', v: email ?? 'Hidden (service key not set)' },
          { icon: LogIn, k: 'Last sign-in', v: lastSignIn ? formatDateTime(lastSignIn) : serviceKeySet ? 'Never signed in' : 'Unknown' },
          { icon: CalendarClock, k: 'Account created', v: formatDate(user.created_at) },
          { icon: KeyRound, k: 'Role', v: ROLE_OPTIONS.find((r) => r.value === user.role)?.hint ?? user.role },
          ...(user.archived_at ? [{ icon: Archive, k: 'Archived', v: formatDate(user.archived_at) }] : []),
        ].map(({ icon: Icon, k, v }) => (
          <div key={k} className="flex items-start gap-3 rounded-[1.5rem] bg-slate-50 p-4 ring-1 ring-black/5">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
            <div className="min-w-0">
              <dt className="text-xs font-black uppercase tracking-wider text-slate-400">{k}</dt>
              <dd className="break-words font-bold">{v}</dd>
            </div>
          </div>
        ))}
      </dl>

      <h4 className="mb-3 mt-7 text-sm font-black uppercase tracking-widest text-slate-500">Work in the system</h4>
      {failed ? (
        <p className="text-sm font-semibold text-slate-500">Could not load the activity of this account.</p>
      ) : !tiles ? (
        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map(({ icon: Icon, label, value, tone }) => (
            <div key={label} className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-black/5">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" aria-hidden /></span>
              <div className="mt-3 text-3xl font-black">{value}</div>
              <div className="text-xs font-bold leading-tight text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      <h4 className="mb-3 mt-7 text-sm font-black uppercase tracking-widest text-slate-500">Latest actions</h4>
      {stats && stats.recent.length === 0 ? (
        <p className="rounded-[1.5rem] bg-slate-50 p-4 text-sm font-semibold text-slate-500">No recorded actions yet.</p>
      ) : stats ? (
        <ol className="space-y-2">
          {stats.recent.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[1.5rem] bg-slate-50 px-4 py-3 ring-1 ring-black/5">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Badge tone={TONE[a.action] ?? 'slate'}>{a.action}</Badge>
                {TABLE[a.table_name] ?? a.table_name}
                {typeof a.detail?.user === 'string' && <span className="text-slate-500">({a.detail.user})</span>}
              </span>
              <span className="text-xs font-semibold text-slate-400">{formatDateTime(a.created_at)}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-2 border-t border-slate-100 pt-6">
        {user.archived_at ? (
          <>
            <button onClick={onRestore} className={btnDark}><ArchiveRestore className="h-4 w-4" /> Restore</button>
            <button onClick={onDelete} disabled={!serviceKeySet} className={`${btnGhost} !text-flag`}><Trash2 className="h-4 w-4" /> Delete permanently</button>
          </>
        ) : (
          <>
            <button onClick={onRename} className={btnGhost}><Pencil className="h-4 w-4" /> Edit name</button>
            {!isMe && <button onClick={onReset} disabled={!serviceKeySet} className={btnGhost}><KeyRound className="h-4 w-4" /> Reset password</button>}
            {!isMe && <button onClick={onArchive} className={btnGhost}><Archive className="h-4 w-4" /> Archive</button>}
          </>
        )}
      </div>
    </Modal>
  )
}
