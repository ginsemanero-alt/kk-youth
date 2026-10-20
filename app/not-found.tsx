import Link from 'next/link'
import { btnPrimary } from '@/components/ui'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="text-8xl font-black tracking-tight text-brand">404</p>
        <h1 className="mt-2 text-3xl font-black">Page not found</h1>
        <Link href="/" className={`${btnPrimary} mt-8`}>Go home</Link>
      </div>
    </main>
  )
}
