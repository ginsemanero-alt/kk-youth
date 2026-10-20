import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SetupNotice from '@/components/SetupNotice'
import { isConfigured } from '@/lib/env'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isConfigured) return <SetupNotice />
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.profile.is_active) redirect('/login?error=inactive')
  return (
    <AppShell role={session.profile.role} name={session.profile.full_name || session.email}>
      {children}
    </AppShell>
  )
}
