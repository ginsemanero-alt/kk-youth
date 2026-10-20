'use client'
import Link from 'next/link'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { btnGhost, btnPrimary } from '@/components/ui'

/** Error boundary inside the app shell: the sidebar stays usable while this page recovers. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md rounded-[3.5rem] bg-white p-10 text-center shadow-sm ring-1 ring-black/5" role="alert">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-flag"><TriangleAlert className="h-8 w-8" aria-hidden /></span>
        <h1 className="mt-5 text-3xl font-black tracking-tight">This page could not load</h1>
        <p className="mt-3 font-semibold text-slate-600">{error.message?.slice(0, 200) || 'Unexpected error.'}</p>
        {error.digest && <p className="mt-1 text-xs font-bold text-slate-400">Reference: {error.digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={reset} className={btnPrimary}><RotateCcw className="h-4 w-4" /> Try again</button>
          <Link href="/dashboard" className={btnGhost}>Go to dashboard</Link>
        </div>
      </div>
    </div>
  )
}
