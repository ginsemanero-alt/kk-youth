'use client'
import { btnPrimary } from '@/components/ui'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-black tracking-tight">Something went wrong</h1>
        <p className="mt-3 font-semibold text-slate-600">{error.message?.slice(0, 200) || 'Unexpected error.'}</p>
        <button onClick={reset} className={`${btnPrimary} mt-6`}>Try again</button>
      </div>
    </main>
  )
}
