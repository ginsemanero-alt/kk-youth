'use client'
import { useEffect, useState } from 'react'

/** Counts from 0 up to the number when it first appears. Keeps any text after the number (like "%"). */
export default function CountUp({ value, duration = 900 }: { value: number | string; duration?: number }) {
  const text = String(value)
  const m = text.match(/^(\d+(?:\.\d+)?)(.*)$/)
  const target = m ? Number(m[1]) : NaN
  const decimals = m && m[1].includes('.') ? m[1].split('.')[1].length : 0
  const [n, setN] = useState(0)

  useEffect(() => {
    if (Number.isNaN(target)) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); return }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setN(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  if (Number.isNaN(target)) return <>{text}</>
  return <>{n.toFixed(decimals)}{m?.[2]}</>
}
