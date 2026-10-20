'use client'
import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'
import { Archive, ArchiveRestore, Check, KeyRound, Loader2, Pencil, Power, PowerOff, Search, Trash2, UserPlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import Modal from '@/components/Modal'
import { ROLE_OPTIONS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import type { Profile, Role } from '@/lib/types'
import { Alert, Badge, Card, EmptyState, Field, RoleBadge, SectionTitle, btnDanger, btnDark, btnGhost, btnPrimary, chipCls, inputCls } from '@/components/ui'
import { createStaffUser, deleteStaffUser, resetStaffPassword, type CreateUserResult } from './actions'

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
const ROLE_TONE: Record<Role, string> = { admin: 'from-ink to-brand-deep', encoder: 'from-brand to-sky-500', viewer: 'from-slate-400 to-slate-500' }

export default function UserManager({ users, emails, meId, serviceKeySet }: {
  users: Profile[]
  emails: Record<string, string>
  meId: string
  serviceKeySet: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [query, setQuery] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [resetFor, setResetFor] = useState<Profile | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [deleteFor, setDeleteFor] = useState<Profile | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [state, action, pending] = useActionState<CreateUserResult | null, FormData>(createStaffUser, null)

  const fail = (m: string) => { setError(m); toast.error(m) }

  const update = async (u: Profile, patch: Partial<Pick<Profile, 'role' | 'is_active' | 'full_name' | 'archived_at'>>, okMsg: string) => {
    setError(null); setBusyId(u.id)
    const { data, error: err } = await createClient().from('profiles').update(patch).eq('id', u.id).select('id')
    setBusyId(null)
    if (err || !data?.length) { fail(err ? friendlyError(err) : 'You do not have permission to change this account.'); return false }
    toast.success(okMsg)
    router.refresh()
    return true
  }

  const doReset = async () => {
    if (!resetFor) return
    setBusyId(resetFor.id)
    const r = await resetStaffPassword(resetFor.id, newPassword)
    setBusyId(null)
    if (!r.ok) return fail(r.error ?? 'Could not reset the password.')
    toast.success(`New password set for ${resetFor.full_name}. Share it privately.`)
    setResetFor(null); setNewPassword('')
  }

  const doDelete = async () => {
    if (!deleteFor) return
    setBusyId(deleteFor.id)
    const r = await deleteStaffUser(deleteFor.id, confirmName)
    setBusyId(null)
    if (!r.ok) return fail(r.error ?? 'Could not delete the account.')
    toast.success(`${deleteFor.full_name} was deleted.`)
    setDeleteFor(null); setConfirmName('')
    router.refresh()
  }

  const archived = users.filter((u) => u.archived_at)
  const active = users.filter((u) => !u.archived_at)
  const q = query.trim().toLowerCase()
  const shown = (tab === 'active' ? active : archived).filter((u) => !q || `${u.full_name} ${emails[u.id] ?? ''} ${u.role}`.toLowerCase().includes(q))

  return (
    <div className="space-y-8">
      <Card>
        <SectionTitle sub="Creates a sign-in account. Share the password privately; ask the user to change it on My account.">Add a staff account</SectionTitle>
        {!serviceKeySet && <div className="mb-4"><Alert tone="info">SUPABASE_SERVICE_ROLE_KEY is not set on the server, so accounts cannot be created, deleted or given a new password from here. Add it to .env.local (or the Vercel environment variables).</Alert></div>}
        {state && !state.ok && <div className="mb-4"><Alert>{state.error}</Alert></div>}
        {state?.ok && <div className="mb-4"><Alert tone="success">Account created.</Alert></div>}
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="u-name"><input id="u-name" name="full_name" className={inputCls} required maxLength={120} /></Field>
          <Field label="Email" htmlFor="u-email"><input id="u-email" name="email" type="email" className={inputCls} required autoComplete="off" /></Field>
          <Field label="Temporary password" hint="At least 8 characters" htmlFor="u-pass"><input id="u-pass" name="password" type="password" minLength={8} className={inputCls} required autoComplete="new-password" /></Field>
          <Field label="Role" htmlFor="u-role">
            <select id="u-role" name="role" defaultValue="viewer" className={inputCls}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label} - {r.hint}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={pending || !serviceKeySet} className={btnPrimary}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create account</button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Accounts">
          <button role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')} className={chipCls(tab === 'active')}>Active and deactivated ({active.length})</button>
          <button role="tab" aria-selected={tab === 'archived'} onClick={() => setTab('archived')} className={chipCls(tab === 'archived')}><Archive className="mr-1.5 h-4 w-4" aria-hidden /> Archived ({archived.length})</button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or role" aria-label="Search accounts" className={`${inputCls} !pl-11`} />
        </div>
      </div>

      {tab === 'archived' && archived.length > 0 && (
        <Alert tone="info">Archived accounts cannot sign in. Restore an account to make it active again, or delete it permanently. Records they made are kept either way.</Alert>
      )}
      {error && <Alert>{error}</Alert>}

      {shown.length === 0 ? (
        <EmptyState icon={tab === 'archived' ? Archive : UserPlus} title={tab === 'archived' ? 'No archived accounts' : 'No accounts match'} hint={tab === 'archived' ? 'Archive an account from the Active tab to move it here.' : undefined} />
      ) : (
        <div className="stagger grid gap-4 lg:grid-cols-2">
          {shown.map((u) => {
            const me = u.id === meId
            const busy = busyId === u.id
            return (
              <div key={u.id} className={`group min-w-0 rounded-[2.5rem] bg-white p-6 shadow-[0_1px_2px_rgb(11_18_56/0.04),0_12px_32px_-12px_rgb(11_18_56/0.12)] ring-1 ring-black/5 transition duration-300 hover:shadow-[0_24px_48px_-16px_rgb(11_18_56/0.2)] sm:p-7 ${u.is_active ? '' : 'bg-slate-50'}`}>
                <div className="flex items-start gap-4">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-black text-white shadow-md ${ROLE_TONE[u.role]} ${u.is_active ? '' : 'grayscale'}`}>{initials(u.full_name || emails[u.id] || '?')}</span>
                  <div className="min-w-0 flex-1">
                    {editId === u.id ? (
                      <div className="flex gap-2">
                        <input aria-label="Full name" className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={120} autoFocus />
                        <button aria-label="Save name" disabled={busy || !editName.trim()} onClick={async () => { if (await update(u, { full_name: editName.trim() }, 'Name updated.')) setEditId(null) }} className={`${btnDark} !px-4`}><Check className="h-4 w-4" /></button>
                        <button aria-label="Cancel" onClick={() => setEditId(null)} className={`${btnGhost} !px-4`}><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <h3 className="flex items-center gap-2 truncate text-xl font-black">
                        <span className="truncate">{u.full_name || 'Unnamed'}</span>
                        {me && <span className="text-xs font-bold text-slate-400">(you)</span>}
                        {!u.archived_at && (
                          <button aria-label={`Edit name of ${u.full_name}`} onClick={() => { setEditId(u.id); setEditName(u.full_name) }} className="rounded-full p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-ink focus:opacity-100 group-hover:opacity-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </h3>
                    )}
                    <p className="truncate text-sm font-semibold text-slate-500">{emails[u.id] ?? 'Email hidden (service key not set)'}</p>
                    <p className="text-xs font-semibold text-slate-400">
                      Joined {formatDate(u.created_at)}{u.archived_at ? ` / Archived ${formatDate(u.archived_at)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <RoleBadge role={u.role} />
                    {u.archived_at ? <Badge tone="ink">Archived</Badge> : !u.is_active && <Badge tone="rose">Deactivated</Badge>}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
                  {u.archived_at ? (
                    <>
                      <button disabled={busy} onClick={() => update(u, { archived_at: null }, `${u.full_name} restored and active again.`)} className={btnDark}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />} Restore
                      </button>
                      <button disabled={busy || !serviceKeySet} onClick={() => { setDeleteFor(u); setConfirmName('') }} className={`${btnGhost} !text-flag`}>
                        <Trash2 className="h-4 w-4" /> Delete permanently
                      </button>
                    </>
                  ) : (
                    <>
                      <select aria-label={`Role for ${u.full_name}`} className={`${inputCls} !w-auto !py-2.5`} value={u.role} disabled={me || busy} onChange={(e) => update(u, { role: e.target.value as Role }, 'Role updated.')}>
                        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      {!me && (
                        <>
                          <button disabled={busy} onClick={() => update(u, { is_active: !u.is_active }, u.is_active ? 'Account deactivated.' : 'Account reactivated.')} className={`${btnGhost} !px-4 !py-2.5`} title={u.is_active ? 'Block sign-in for now' : 'Allow sign-in again'}>
                            {u.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />} {u.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                          <button disabled={busy || !serviceKeySet} onClick={() => { setResetFor(u); setNewPassword('') }} className={`${btnGhost} !px-4 !py-2.5`}>
                            <KeyRound className="h-4 w-4" /> Reset password
                          </button>
                          <button disabled={busy} onClick={() => update(u, { archived_at: new Date().toISOString() }, `${u.full_name} archived.`)} className={`${btnGhost} !px-4 !py-2.5`} title="Hide this account and block sign-in. You can restore it later.">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Archive
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {resetFor && (
        <Modal title={`Reset password: ${resetFor.full_name}`} onClose={() => setResetFor(null)}>
          <p className="mb-4 text-sm font-semibold text-slate-500">Set a temporary password, share it privately, and ask them to change it on My account. This is recorded in the audit log.</p>
          <Field label="New temporary password" hint="At least 8 characters" htmlFor="reset-pass">
            <input id="reset-pass" type="text" className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" />
          </Field>
          <button onClick={doReset} disabled={busyId !== null || newPassword.length < 8} className={`${btnPrimary} mt-4 w-full`}>
            {busyId === resetFor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Set new password
          </button>
        </Modal>
      )}

      {deleteFor && (
        <Modal title="Delete account permanently" onClose={() => setDeleteFor(null)}>
          <Alert>This cannot be undone. {deleteFor.full_name} will no longer be able to sign in, and the account cannot be restored. Youth records, activities and the audit log they made are kept.</Alert>
          <div className="mt-5">
            <Field label={`Type "${deleteFor.full_name}" to confirm`} htmlFor="del-confirm">
              <input id="del-confirm" className={inputCls} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
            </Field>
          </div>
          <button onClick={doDelete} disabled={busyId !== null || confirmName.trim() !== deleteFor.full_name.trim()} className={`${btnDanger} mt-4 w-full`}>
            {busyId === deleteFor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete permanently
          </button>
        </Modal>
      )}
    </div>
  )
}
