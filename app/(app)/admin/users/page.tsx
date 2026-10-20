import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/lib/types'
import { PageHeader } from '@/components/ui'
import UserManager from './UserManager'

export const metadata = { title: 'Users' }
export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const session = await requireRole(['admin'], '/admin/users')
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  // Email addresses live in Supabase Auth, which only the service role can list (server side).
  const serviceKeySet = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const emails: Record<string, string> = {}
  const lastSignIn: Record<string, string> = {}
  if (serviceKeySet) {
    try {
      const { data: list } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 })
      for (const u of list?.users ?? []) {
        if (u.email) emails[u.id] = u.email
        if (u.last_sign_in_at) lastSignIn[u.id] = u.last_sign_in_at
      }
    } catch { /* emails and sign-in times are optional */ }
  }
  return (
    <div>
      <PageHeader eyebrow="Access control" title="Users and roles" subtitle="Create accounts, change roles, rename, reset passwords, archive or delete. Roles are enforced by the database; changes take effect immediately." />
      <UserManager users={(data ?? []) as Profile[]} emails={emails} lastSignIn={lastSignIn} meId={session.userId} serviceKeySet={serviceKeySet} />
    </div>
  )
}
