import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'
import { PageHeader } from '@/components/ui'
import UserManager from './UserManager'

export const metadata = { title: 'Users' }
export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const session = await requireRole(['admin'])
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  return (
    <div>
      <PageHeader eyebrow="Access control" title="Users and roles" subtitle="Roles are stored in the database and enforced by Row Level Security. Changes take effect immediately." />
      <UserManager users={(data ?? []) as Profile[]} meId={session.userId} serviceKeySet={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} />
    </div>
  )
}
