import { isConfigured } from '@/lib/env'
import SetupNotice from '@/components/SetupNotice'
import { createClient } from '@/lib/supabase/server'
import RegisterForm from './RegisterForm'

export const metadata = { title: 'Youth self-registration' }
export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  if (!isConfigured) return <SetupNotice />
  const supabase = await createClient()
  const { data } = await supabase.from('puroks').select('id, name').is('deleted_at', null).order('name')
  return <RegisterForm puroks={data ?? []} />
}
