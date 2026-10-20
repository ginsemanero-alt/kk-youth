'use client'
import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { ROLE_OPTIONS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import type { Profile, Role } from '@/lib/types'
import { Alert, Badge, Card, Field, RoleBadge, SectionTitle, btnPrimary, inputCls } from '@/components/ui'
import { createStaffUser, type CreateUserResult } from './actions'

export default function UserManager({ users, meId, serviceKeySet }: { users: Profile[]; meId: string; serviceKeySet: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [state, action, pending] = useActionState<CreateUserResult | null, FormData>(createStaffUser, null)

  const update = async (u: Profile, patch: Partial<Pick<Profile, 'role' | 'is_active'>>) => {
    setError(null); setBusyId(u.id)
    const { data, error: err } = await createClient().from('profiles').update(patch).eq('id', u.id).select('id')
    setBusyId(null)
    if (err || !data?.length) { const m = friendlyError(err); setError(m); return toast.error(m) }
    toast.success('Account updated.')
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <Card>
        <SectionTitle sub="Creates a sign-in account. Share the password privately; ask the user to keep it safe.">Add a staff account</SectionTitle>
        {!serviceKeySet && <div className="mb-4"><Alert tone="info">SUPABASE_SERVICE_ROLE_KEY is not set on the server, so accounts cannot be created from here. Add it to .env.local, or create users in Supabase Dashboard, Authentication.</Alert></div>}
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

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        {users.map((u) => (
          <div key={u.id} className={`rounded-[3rem] bg-white p-7 shadow-sm ring-1 ring-black/5 ${u.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-xl font-black">{u.full_name || 'Unnamed'}{u.id === meId && <span className="ml-2 text-xs font-bold text-slate-400">(you)</span>}</h3>
                <p className="text-xs font-semibold text-slate-400">Joined {formatDate(u.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5"><RoleBadge role={u.role} />{!u.is_active && <Badge tone="rose">Deactivated</Badge>}</div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <select aria-label={`Role for ${u.full_name}`} className={`${inputCls} !w-auto`} value={u.role} disabled={u.id === meId || busyId === u.id} onChange={(e) => update(u, { role: e.target.value as Role })}>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {u.id !== meId && (
                <button onClick={() => update(u, { is_active: !u.is_active })} disabled={busyId === u.id} className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black hover:bg-slate-200 disabled:opacity-50">
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
