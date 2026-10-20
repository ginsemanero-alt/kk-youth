'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Download, ExternalLink, Printer, TriangleAlert } from 'lucide-react'
import QRCode from 'qrcode'
import { Logo } from '@/components/Logo'
import { ORG } from '@/lib/constants'
import { Card, btnGhost, btnSun } from '@/components/ui'

const isLocal = (host: string) => /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host)

/**
 * The public registration address. NEXT_PUBLIC_SITE_URL is used when it is a real address; if it
 * still says localhost (the .env.example default) while the site runs elsewhere, the address the
 * page is open on is used instead, so phones can open the scanned link.
 */
function registrationUrl(): { url: string; envIgnored: boolean } {
  const here = window.location.origin
  const env = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '')
  let base = here
  let envIgnored = false
  if (env) {
    try {
      const u = new URL(env)
      if (isLocal(u.hostname) && !isLocal(window.location.hostname)) envIgnored = true
      else base = u.origin
    } catch { envIgnored = true }
  }
  return { url: `${base}/register`, envIgnored }
}

export default function RegistrationQr() {
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState('')
  const [qrHd, setQrHd] = useState('')
  const [envIgnored, setEnvIgnored] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const r = registrationUrl()
    setUrl(r.url)
    setEnvIgnored(r.envIgnored)
    const opts = { margin: 2, errorCorrectionLevel: 'M' as const, color: { dark: '#0b1238', light: '#ffffff' } }
    QRCode.toDataURL(r.url, { ...opts, width: 480 }).then(setQr).catch(() => setQr(''))
    QRCode.toDataURL(r.url, { ...opts, width: 1200 }).then(setQrHd).catch(() => setQrHd(''))
  }, [])

  // Print only the poster below, never the registration list on this page (it has personal data).
  useEffect(() => {
    const done = () => document.body.classList.remove('printing-qr')
    window.addEventListener('afterprint', done)
    return () => window.removeEventListener('afterprint', done)
  }, [])
  const printPoster = () => {
    document.body.classList.add('printing-qr')
    window.print()
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }

  return (
    <>
      <Card className="relative isolate overflow-hidden !bg-linear-to-br from-brand to-brand-deep !text-white">
        <div className="absolute -right-12 -top-12 -z-10 h-56 w-56 rounded-full bg-sun/25 blur-3xl" aria-hidden />
        <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
          <div className="mx-auto rounded-[2.5rem] bg-white p-4 shadow-xl">
            {qr
              ? <img src={qr} alt="QR code for the self-registration form" width={208} height={208} className="h-52 w-52" />
              : <div className="h-52 w-52 animate-pulse rounded-2xl bg-slate-100" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-3xl font-black tracking-tight">Share the registration link</h2>
            <p className="mt-2 font-semibold text-white/80">Post the QR code on the barangay hall bulletin board or send the link in the youth group chat. Scanning it opens the youth registration form.</p>
            <p className="mt-3 break-all rounded-[1.5rem] bg-white/15 px-5 py-2.5 text-sm font-bold">{url || '...'}</p>
            {envIgnored && (
              <p className="mt-3 flex items-start gap-2 rounded-[1.5rem] bg-sun/20 px-4 py-3 text-xs font-bold text-white ring-1 ring-sun/40">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-sun" aria-hidden />
                NEXT_PUBLIC_SITE_URL is set to a local address, so this page&apos;s own address is used instead. Set it to your public site address (for example https://your-site.vercel.app) in the Vercel environment variables.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={copy} disabled={!url} className={btnSun}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}</button>
              <a href={qrHd || undefined} download="sk-registration-qr.png" aria-disabled={!qrHd} className={`${btnGhost} !bg-white/15 !text-white !ring-white/30 ${qrHd ? '' : 'pointer-events-none opacity-50'}`}>
                <Download className="h-4 w-4" /> Download PNG
              </a>
              <button onClick={printPoster} disabled={!qr} className={`${btnGhost} !bg-white/15 !text-white !ring-white/30`}><Printer className="h-4 w-4" /> Print poster</button>
              <a href={url || undefined} target="_blank" rel="noreferrer" className={`${btnGhost} !bg-white/15 !text-white !ring-white/30`}><ExternalLink className="h-4 w-4" /> Open form</a>
            </div>
          </div>
        </div>
      </Card>

      {/* Print-only poster, placed directly in <body> so printing can hide everything else (see .qr-poster in globals.css). */}
      {url && createPortal(
      <div className="qr-poster" aria-hidden>
        <div className="flex flex-col items-center text-center text-black">
          <Logo size={120} eager />
          <p className="mt-4 text-sm font-black uppercase tracking-widest">{ORG.sk}</p>
          <h1 className="mt-2 text-5xl font-black">Youth Registration</h1>
          <p className="mt-2 text-lg font-semibold">Katipunan ng Kabataan profiling, ages 15 to 30</p>
          {qrHd && <img src={qrHd} alt="" width={420} height={420} className="mt-8 h-[105mm] w-[105mm]" />}
          <p className="mt-6 text-xl font-black">Scan with your phone camera</p>
          <p className="mt-2 break-all text-base font-semibold">{url}</p>
          <p className="mt-8 max-w-md text-xs font-semibold">Your answers are reviewed by an SK encoder and protected under the Data Privacy Act of 2012 (RA 10173).</p>
        </div>
      </div>,
      document.body)}
    </>
  )
}
