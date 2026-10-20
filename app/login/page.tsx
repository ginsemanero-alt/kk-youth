import { isConfigured } from '@/lib/env'
import SetupNotice from '@/components/SetupNotice'
import LoginForm from './LoginForm'

export const metadata = { title: 'Staff sign in' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!isConfigured) return <SetupNotice />
  const { next, error } = await searchParams
  return <LoginForm next={next} inactive={error === 'inactive'} />
}
