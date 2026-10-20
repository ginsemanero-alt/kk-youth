'use server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth'
import type { Role } from '@/lib/types'

export interface CreateUserResult { ok: boolean; error?: string }

/**
 * Create a staff account. Runs on the server with the service-role key, which never reaches the browser.
 * The caller is re-verified as an active Admin on every call; the role is then written by the server,
 * never taken from a client-controlled auth field.
 */
export async function createStaffUser(_prev: CreateUserResult | null, formData: FormData): Promise<CreateUserResult> {
  const session = await getSession()
  if (!session || session.profile.role !== 'admin' || !session.profile.is_active) return { ok: false, error: 'Only an Admin can create accounts.' }

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
