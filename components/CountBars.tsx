import type { ReactNode } from 'react'
import { countText, countValue, type ReportCount } from '@/lib/summary'

/** A titled card of horizontal bars, for aggregate counts (no names). Works in server and client components. */
export default function CountBars({ title, items, tone = 'bg-brand', icon, empty = 'No data yet' }: {
  title: string
  items: { label: string; count: ReportCount }[]
  tone?: string
  icon?: ReactNode
  empty?: string
}) {
  const max = Math.max(1, ...items.map((i) => countValue(i.count)))
  return (
    <section className="rounded-[2.5rem] bg-white p-6 shadow-[0_1px_2px_rgb(11_18_56/0.04),0_12px_32px_-12px_rgb(11_18_56/0.12)] ring-1 ring-black/5 sm:p-7">
      <h3 className="flex items-center gap-2 text-lg font-black tracking-tight">
        {icon ?? <span className="h-6 w-1.5 rounded-full bg-linear-to-b from-brand via-sun to-flag" aria-hidden />}
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((i) => (
            <li key={i.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm font-bold">
                <span className="min-w-0 truncate text-slate-700">{i.label}</span>
                <span className="shrink-0 font-black">{countText(i.count)}</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${Math.max(4, (countValue(i.count) / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
