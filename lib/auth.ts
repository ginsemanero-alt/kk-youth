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

/**
 * Page guard: must be signed in, active, and one of the allowed roles. The role is read from
 * public.profiles on every request (never from the browser), and RLS re-checks every query.
 * `path` is the route pattern (for example '/youth/[id]'); a refused visit is written to the
 * audit log as 'denied' (at most once a minute per user and page).
 */
export async function requireRole(allowed: Role[], path?: string): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.profile.is_active) redirect('/login?error=inactive')
  if (!allowed.includes(session.profile.role)) {
    if (path) {
      const supabase = await createClient()
      await supabase.rpc('log_access_denied', { p_path: path }) // best effort; the redirect happens either way
    }
    redirect('/dashboard?denied=1')
  }
  return session
}

/** Admin and Encoder: may see and edit individual youth records. */
export const canEdit = (role: Role) => role === 'admin' || role === 'encoder'
export const STAFF: Role[] = ['admin', 'encoder']
export const ALL_ROLES: Role[] = ['admin', 'encoder', 'viewer']
