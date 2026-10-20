import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/plus-jakarta-sans'
import './globals.css'
import { ToastProvider } from '@/components/Toast'

export const metadata: Metadata = {
  title: { default: 'KK Youth Profiling System', template: '%s | KK Youth Profiling' },
  description: 'Youth profiling and management system for the Sangguniang Kabataan.',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0a1230' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
