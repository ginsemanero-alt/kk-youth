import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Role } from '@/lib/types'

export interface Session {
  userId: string
  email: string
  profile: Profile
}

/** Current user + profile, or null. Always validates the token with Supabase Auth. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).maybeSingle()
  if (!profile) return null
  return { userId: userData.user.id, email: userData.user.email ?? '', profile: profile as Profile }
}

/** Page guard: must be signed in, active, and one of the allowed roles (RLS still re-checks every query). */
export async function requireRole(allowed: Role[]): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.profile.is_active) redirect('/login?error=inactive')
  if (!allowed.includes(session.profile.role)) redirect('/dashboard?denied=1')
  return session
}

export const canEdit = (role: Role) => role === 'admin' || role === 'encoder'
