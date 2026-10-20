'use client'
import { useCallback, useEffect, useState } from 'react'
import { Info, Loader2, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ExportButtons from '@/components/ExportButtons'
import CountBars from '@/components/CountBars'
import { AGE_BRACKETS } from '@/lib/constants'
import { friendlyError } from '@/lib/errors'
import type { Row } from '@/lib/export'
import { GROUPS, countText, groupLabel, type SummaryReport as Summary } from '@/lib/summary'
import { Alert, Card, Field, StatCard, inputCls } from '@/components/ui'

const TONES = ['bg-brand', 'bg-sun', 'bg-flag', 'bg-grape', 'bg-emerald-600', 'bg-ink']
const SHOWN = GROUPS.filter((g) => !g.key.startsWith('osy_'))

/** Aggregate report (counts only, no names) from summary_report(). Used by every role. */
export default function SummaryReport({ puroks }: { puroks: { id: string; name: string }[] }) {
  const [purok, setPurok] = useState('')
  const [bracket, setBracket] = useState('')
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true); setError(null)
    const { data: d, error: err } = await createClient().rpc('summary_report', { p_purok: purok || null, p_bracket: bracket || null })
    setLoading(false)
    if (err) return setError(friendlyError(err))
    setData(d as Summary)
  }, [purok, bracket])

  useEffect(() => { void run() }, [run])

  const filters = { purok: puroks.find((p) => p.id === purok)?.name ?? 'All', ageBracket: bracket || 'All' }
  const subtitle = `Purok: ${filters.purok} | Age: ${filters.ageBracket} | Active youth: ${data ? countText(data.total) : '...'}`

  // One flat table for Excel and PDF: category, value, count.
  const rows: Row[] = data ? [
    { Category: 'Total', Value: 'Active youth', Count: countText(data.total) },
    { Category: 'Total', Value: 'Out-of-school youth', Count: countText(data.osy) },
    ...GROUPS.flatMap((g) => (data.groups[g.key] ?? []).map((i) => ({ Category: g.title, Value: groupLabel(g.key, i.label), Count: countText(i.count) }))),
    ...data.questions.flatMap((q) => q.counts.map((c) => ({ Category: q.label, Value: c.label, Count: countText(c.count) }))),
  ] : []
  const columns = ['Category', 'Value', 'Count'].map((k) => ({ header: k, key: k }))

  return (
    <div className="space-y-6">
      <Card className="!p-6 sm:!p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Purok" htmlFor="s-purok">
            <select id="s-purok" className={inputCls} value={purok} onChange={(e) => setPurok(e.target.value)}>
              <option value="">All puroks</option>{puroks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Age group" htmlFor="s-age">
            <select id="s-age" className={inputCls} value={bracket} onChange={(e) => setBracket(e.target.value)}>
              <option value="">All ages</option>{AGE_BRACKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}
      {data?.masked && (
        <Alert tone="info">
          <span className="inline-flex items-center gap-1.5"><Info className="h-4 w-4" aria-hidden /> Counts of 1 or 2 are shown as &quot;&lt;3&quot; so that no single youth can be identified.</span>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:max-w-md sm:gap-5">
          <StatCard label="Active youth" value={loading || !data ? '...' : data.total} tone="bg-ink text-white" icon={Users} />
          <StatCard label="Out of school" value={loading || !data ? '...' : data.osy} tone="bg-flag text-white" />
        </div>
        <ExportButtons rows={rows} columns={columns} title="Youth summary report" subtitle={subtitle} filename="youth-summary" source="summary_report" filters={filters} printable />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      ) : data && (
        <div className="stagger grid gap-5 md:grid-cols-2">
          {SHOWN.map((g, i) => (
            <CountBars key={g.key} title={g.title} tone={TONES[i % TONES.length]}
              items={(data.groups[g.key] ?? []).map((x) => ({ label: groupLabel(g.key, x.label), count: x.count }))} />
          ))}
          {data.questions.map((q, i) => (
            <CountBars key={q.id} title={q.label} tone={TONES[(i + 2) % TONES.length]} items={q.counts} />
          ))}
        </div>
      )}

      {/* Print layout */}
      <section className="print-only text-black">
        <h1 className="text-2xl font-black">Youth summary report</h1>
        <p className="mt-1 text-xs font-semibold">{subtitle}</p>
        <table className="mt-4 w-full border-collapse text-left text-[10px]">
          <thead><tr className="border-b-2 border-black font-black uppercase"><th className="py-1 pr-2">Category</th><th className="py-1 pr-2">Value</th><th className="py-1">Count</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-slate-300"><td className="py-1 pr-2">{r.Category}</td><td className="py-1 pr-2">{r.Value}</td><td className="py-1">{r.Count}</td></tr>)}</tbody>
        </table>
        <p className="mt-4 text-[9px] font-semibold">Aggregate counts only. No names or contact details.</p>
      </section>
    </div>
  )
}
