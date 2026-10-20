'use client'
import { useEffect, useState } from 'react'
import { Check, Copy, Printer } from 'lucide-react'
import QRCode from 'qrcode'
import { Card, btnGhost, btnSun } from '@/components/ui'

export default function RegistrationQr() {
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '')
    const link = `${base}/register`
    setUrl(link)
    QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#0b1238', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [])

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }

  return (
    <Card className="!bg-brand !text-white">
      <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
        <div className="mx-auto rounded-[2.5rem] bg-white p-4">
          {qr ? <img src={qr} alt="QR code for the self-registration form" width={180} height={180} className="h-44 w-44" /> : <div className="h-44 w-44 animate-pulse rounded-2xl bg-slate-100" />}
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight">Share the registration link</h2>
          <p className="mt-2 font-semibold text-white/80">Post the QR code on the barangay hall bulletin board or send the link in the youth group chat.</p>
          <p className="mt-3 break-all rounded-full bg-white/15 px-5 py-2.5 text-sm font-bold">{url}</p>
          <div className="no-print mt-4 flex flex-wrap gap-2">
            <button onClick={copy} className={btnSun}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}</button>
            <button onClick={() => window.print()} className={`${btnGhost} !bg-white/15 !text-white !ring-white/30`}><Printer className="h-4 w-4" /> Print</button>
          </div>
        </div>
      </div>
    </Card>
  )
}
