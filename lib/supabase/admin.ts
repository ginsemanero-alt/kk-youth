import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '@/lib/env'

/**
 * Service-role client. SERVER ONLY (the 'server-only' import makes the build fail if a client
 * component ever imports this file). Bypasses RLS, so use it for nothing except creating auth users.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the server.')
  return createClient(SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
