'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ArrowLeft, Loader2, LogIn } from 'lucide-react'
import { BrandMark, Logo, TriStripe } from '@/components/Logo'
import { ORG } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { Alert, Field, btnPrimary, inputCls } from '@/components/ui'

// Only allow same-site relative redirects.
const safeNext = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard')

export default function LoginForm({ next, inactive }: { next?: string; inactive?: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(inactive ? 'Your account is deactivated. Please contact the SK Admin.' : null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) {
      setBusy(false)
      return setError(friendlyError(err))
    }
    router.replace(safeNext(next))
    router.refresh()
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-ink via-ink to-brand-deep p-12 text-white lg:flex">
        <TriStripe className="absolute inset-x-0 top-0 h-1.5" />
        <div className="absolute -right-24 -top-24 h-96 w-96 animate-drift rounded-full bg-brand/60 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 animate-drift rounded-full bg-sun/25 blur-3xl [animation-delay:-8s]" aria-hidden />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" aria-hidden />
        <Link href="/" className="relative w-fit" aria-label="Home"><BrandMark tone="light" size={48} /></Link>
        <div className="relative stagger">
          <div className="relative w-fit animate-float">
            <div className="tri-ring absolute -inset-2.5 animate-spin-slow rounded-full" aria-hidden />
            <div className="absolute -inset-1 rounded-full bg-ink" aria-hidden />
            <Logo size={176} preload className="relative !ring-4 shadow-2xl" />
          </div>
          <h2 className="mt-10 text-6xl font-black leading-[1.02] tracking-tight">Know your youth.<br />Plan for them.</h2>
          <p className="mt-6 max-w-md text-lg font-semibold text-white/70">Staff access for the officers and encoders of the {ORG.sk}. Every action is recorded in the audit log.</p>
        </div>
        <p className="relative text-sm font-semibold text-white/50">Data Privacy Act of 2012 (RA 10173) aware by design.</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-rise rounded-[3.5rem] bg-white p-8 shadow-[0_24px_60px_-24px_rgb(11_18_56/0.3)] ring-1 ring-black/5 sm:p-10">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <div className="mb-6 lg:hidden"><BrandMark tone="dark" size={56} preload /></div>
          <h1 className="text-5xl font-black tracking-tight">Sign in</h1>
          <p className="mt-2 font-semibold text-slate-500">For SK staff only. Youth can register without an account.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {error && <Alert>{error}</Alert>}
            <Field label="Email" htmlFor="email">
              <input id="email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            <Field label="Password" htmlFor="password">
              <input id="password" type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </Field>
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-4 text-base`}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />} Sign in
            </button>
          </form>
          <p className="mt-6 text-sm font-semibold text-slate-500">
            No account? Ask the SK Chairperson or Secretary to create one for you. Youth who want to be profiled can use the{' '}
            <Link href="/register" className="font-black text-brand underline">self-registration form</Link>.
          </p>
        </div>
      </section>
    </main>
  )
}
