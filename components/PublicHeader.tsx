import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandMark, TriStripe } from '@/components/Logo'

/** Top bar for public pages (registration, privacy notice): logo, name and a way home. */
export default function PublicHeader({ back = true }: { back?: boolean }) {
  return (
    <header className="no-print sticky top-0 z-30 bg-white/85 shadow-sm backdrop-blur">
      <TriStripe />
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link href="/" aria-label="Home"><BrandMark tone="dark" size={42} /></Link>
        {back && (
          <Link href="/" className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-slate-500 ring-1 ring-black/10 hover:bg-slate-50 hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Home
          </Link>
        )}
      </div>
    </header>
  )
}
