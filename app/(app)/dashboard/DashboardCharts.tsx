'use client'
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CountItem, DashboardSummary } from '@/lib/types'

const tip = { borderRadius: 20, border: 'none', boxShadow: '0 10px 30px rgba(10,18,48,0.18)', fontWeight: 700 }
const tick = { fontSize: 11, fontWeight: 700 }
const EMP: Record<string, { label: string; color: string }> = {
  employed: { label: 'Employed', color: '#059669' },
  self_employed: { label: 'Self-employed', color: '#0d9488' },
  unemployed: { label: 'Unemployed', color: '#f59e0b' },
}

function ChartCard({ title, sub, children, wide }: { title: string; sub?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`rounded-[3.5rem] bg-white p-8 shadow-sm ring-1 ring-black/5 sm:p-10 ${wide ? 'lg:col-span-2' : ''}`}>
      <h2 className="text-xl font-black tracking-tight">{title}</h2>
      {sub && <p className="text-sm font-semibold text-slate-400">{sub}</p>}
      <div className="mt-5 h-72">{children}</div>
    </section>
  )
}

const NoData = () => <div className="flex h-full items-center justify-center font-bold text-slate-400">No data yet</div>

function Donut({ data }: { data: { name: string; value: number; color: string }[] }) {
  const rows = data.filter((d) => d.value > 0)
  if (!rows.length) return <NoData />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie isAnimationActive={false} data={rows} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={3} stroke="none">
          {rows.map((r) => <Cell key={r.name} fill={r.color} />)}
        </Pie>
        <Tooltip contentStyle={tip} />
        <Legend wrapperStyle={{ fontWeight: 700, fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function HBars({ items, color }: { items: CountItem[]; color: string }) {
  if (!items.length) return <NoData />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={items} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={tick} />
        <YAxis type="category" dataKey="label" width={110} tick={tick} />
        <Tooltip contentStyle={tip} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="count" name="Youth" fill={color} radius={[0, 16, 16, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function DashboardCharts({ data }: { data: DashboardSummary }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Age brackets" sub="15 to 17 child youth, 18 to 24 core youth, 25 to 30 young adult">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.age_brackets} margin={{ left: -10, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={tick} />
            <YAxis allowDecimals={false} tick={tick} />
            <Tooltip contentStyle={tip} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="count" name="Youth" fill="#1d4ed8" radius={[18, 18, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="In school vs out of school">
        <Donut data={[
          { name: 'In-School', value: data.in_school, color: '#0ea5e9' },
          { name: 'OSY', value: data.out_of_school, color: '#dc2626' },
          { name: 'Graduated', value: data.graduated, color: '#059669' },
        ]} />
      </ChartCard>

      <ChartCard title="Employment">
        <Donut data={data.employment.map((e) => ({ name: EMP[e.label]?.label ?? e.label, value: e.count, color: EMP[e.label]?.color ?? '#94a3b8' }))} />
      </ChartCard>

      <ChartCard title="Youth per purok">
        <HBars items={data.puroks} color="#0a1230" />
      </ChartCard>

      <ChartCard title="Top skills">
        <HBars items={data.top_skills} color="#facc15" />
      </ChartCard>

      <ChartCard title="Top interests">
        <HBars items={data.top_interests} color="#dc2626" />
      </ChartCard>
    </div>
  )
}
