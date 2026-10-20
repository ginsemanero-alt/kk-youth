import { requireRole } from '@/lib/auth'
import { Card, PageHeader, RoleBadge } from '@/components/ui'
import PasswordForm from './PasswordForm'

export const metadata = { title: 'My account' }

export default async function AccountPage() {
  // Role and name come from profiles (database), never from the client.
  const session = await requireRole(['admin', 'encoder', 'viewer'], '/account')
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Account" title="My account" subtitle="Your sign-in details and password." />
      <Card>
        <dl className="grid gap-6 sm:grid-cols-3">
          <div><dt className="text-xs font-black uppercase tracking-widest text-slate-400">Name</dt><dd className="mt-1 text-lg font-black">{session.profile.full_name || 'Not set'}</dd></div>
          <div><dt className="text-xs font-black uppercase tracking-widest text-slate-400">Email</dt><dd className="mt-1 break-all text-lg font-black">{session.email}</dd></div>
          <div><dt className="text-xs font-black uppercase tracking-widest text-slate-400">Role</dt><dd className="mt-2"><RoleBadge role={session.profile.role} /></dd></div>
        </dl>
      </Card>
      <PasswordForm email={session.email} />
    </div>
  )
}
