import { Card } from '@/components/ui'
import { Logo } from '@/components/Logo'

export default function SetupNotice() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Card>
        <Logo size={72} className="mb-5" />
        <span className="inline-block rounded-full bg-sun px-4 py-1.5 text-xs font-black uppercase tracking-widest">Setup needed</span>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Connect Supabase</h1>
        <p className="mt-3 font-semibold text-slate-600">
          The app is running but has no Supabase credentials yet. Create a <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local</code> file (copy <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.example</code>) and set:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-[2rem] bg-ink p-5 text-sm font-semibold text-white">{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...`}</pre>
        <p className="mt-4 text-sm font-semibold text-slate-500">
          Then run the SQL files in <code>supabase/</code> (or just <code>supabase/all_in_one.sql</code>) and restart <code>npm run dev</code>. See README.md.
        </p>
      </Card>
    </main>
  )
}
