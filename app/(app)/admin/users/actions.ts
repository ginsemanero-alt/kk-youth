'use server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { friendlyError } from '@/lib/errors'
import type { Role } from '@/lib/types'

export interface CreateUserResult { ok: boolean; error?: string }
export interface UserActionResult { ok: boolean; error?: string }

/** The caller must be an active Admin, read from the database on every call. */
async function requireAdmin() {
  const session = await getSession()
  if (!session || session.profile.role !== 'admin' || !session.profile.is_active) return null
  return session
}

/**
 * Create a staff account. Runs on the server with the service-role key, which never reaches the browser.
 * The caller is re-verified as an active Admin on every call; the role is then written by the server,
 * never taken from a client-controlled auth field.
 */
export async function createStaffUser(_prev: CreateUserResult | null, formData: FormData): Promise<CreateUserResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Only an Admin can create accounts.' }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const role = String(formData.get('role') ?? '') as Role

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  if (!fullName) return { ok: false, error: 'Full name is required.' }
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
  if (!['admin', 'encoder', 'viewer'].includes(role)) return { ok: false, error: 'Choose a role.' }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    })
    if (error || !data.user) return { ok: false, error: error?.message ?? 'Could not create the user.' }
    // The signup trigger creates the profile as 'viewer'. Promote with the service role (auth.uid() is null there).
    const { error: upErr } = await admin.from('profiles').update({ role, full_name: fullName }).eq('id', data.user.id)
    if (upErr) return { ok: false, error: `Account created but the role was not set: ${upErr.message}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error.' }
  }
  revalidatePath('/admin/users')
  return { ok: true }
}

/**
 * Permanently delete a staff account. The database first checks (with the Admin's own session) that the
 * caller is an Admin and is not deleting themselves, and writes the audit entry; only then does the
 * service role remove the sign-in. Youth records the user made are kept.
 */
export async function deleteStaffUser(userId: string, confirmName: string): Promise<UserActionResult> {
  const session = await requireAdmin()
  if (!session) return { ok: false, error: 'Only an Admin can delete accounts.' }
  if (userId === session.userId) return { ok: false, error: 'You cannot delete your own account.' }

  const supabase = await createClient()
  const { data: target } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
  if (!target) return { ok: false, error: 'User not found.' }
  if (confirmName.trim() !== (target.full_name || '').trim()) return { ok: false, error: 'The name you typed does not match.' }

  const { error: logErr } = await supabase.rpc('log_user_admin_action', { p_user: userId, p_action: 'delete' })
  if (logErr) return { ok: false, error: friendlyError(logErr) }
  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(userId)
    if (error) return { ok: false, error: error.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error.' }
  }
  revalidatePath('/admin/users')
  return { ok: true }
}

/** Set a new temporary password for another staff account (checked and audited like delete). */
export async function resetStaffPassword(userId: string, password: string): Promise<UserActionResult> {
  const session = await requireAdmin()
  if (!session) return { ok: false, error: 'Only an Admin can reset passwords.' }
  if (userId === session.userId) return { ok: false, error: 'Change your own password on the My account page.' }
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }

  const supabase = await createClient()
  const { error: logErr } = await supabase.rpc('log_user_admin_action', { p_user: userId, p_action: 'password_reset' })
  if (logErr) return { ok: false, error: friendlyError(logErr) }
  try {
    const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password })
    if (error) return { ok: false, error: error.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error.' }
  }
  return { ok: true }
}
