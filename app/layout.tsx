import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/plus-jakarta-sans'
import './globals.css'
import { ToastProvider } from '@/components/Toast'
import { ORG } from '@/lib/constants'

export const metadata: Metadata = {
  title: { default: `${ORG.short} | KK Youth Profiling`, template: `%s | ${ORG.short}` },
  description: `Katipunan ng Kabataan youth profiling and management system of the ${ORG.sk}.`,
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b1238' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
