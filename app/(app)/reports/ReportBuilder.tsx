'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ExportButtons from '@/components/ExportButtons'
import { ShieldAlert } from 'lucide-react'
import { AGE_BRACKETS, EDU_LEVEL_OPTIONS, EDU_STATUS_OPTIONS, EMPLOYMENT_OPTIONS, CIVIL_OPTIONS, SECTOR_OPTIONS, label, yesNo } from '@/lib/constants'
import { friendlyError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import type { Row } from '@/lib/export'
import type { Role, YouthOverview, YouthSensitive } from '@/lib/types'
import { Alert, Card, EducationBadge, EmploymentBadge, Field, StatCard, inputCls } from '@/components/ui'

// Email and contact numbers are never exported (data minimization).
const BASE_COLUMNS = [
  'Youth ID', 'Name', 'Age', 'Age bracket', 'Sex', 'Civil status', 'Birthdate', 'Purok', 'Education', 'Level', 'Course',
  'Employment', 'Sector', 'Registered SK voter', 'Youth organization', 'Skills', 'Interests',
]
const SENSITIVE_COLUMNS = ['Religion', 'PWD', 'Medical condition']

export default function ReportBuilder({ puroks, role }: { puroks: { id: string; name: string }[]; role: Role }) {
  const [purok, setPurok] = useState('')
  const [bracket, setBracket] = useState('')
  const [edu, setEdu] = useState('')
  const [emp, setEmp] = useState('')
  const [rows, setRows] = useState<YouthOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Admin only: the database refuses this read for every other role, and it is logged.
  const [withSensitive, setWithSensitive] = useState(false)
  const [sensitive, setSensitive] = useState<Map<string, YouthSensitive> | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    let q = createClient().from('youth_overview').select('*').is('deleted_at', null)
    if (purok) q = q.eq('purok_id', purok)
    if (bracket) q = q.eq('age_bracket', bracket)
    if (edu) q = q.eq('education_status', edu)
    if (emp) q = q.eq('employment_status', emp)
    const { data, error: err } = await q.order('last_name').order('first_name').limit(5000)
    setLoading(false)
    if (err) return setError(friendlyError(err))
    setRows((data ?? []) as YouthOverview[])
  }, [purok, bracket, edu, emp])

  useEffect(() => { void run() }, [run])

  useEffect(() => {
    setSensitive(null)
    if (!withSensitive || role !== 'admin' || rows.length === 0) return
    let cancelled = false
    void (async () => {
      const { data, error: err } = await createClient().rpc('get_youth_sensitive_bulk', { p_ids: rows.map((r) => r.id) })
      if (cancelled) return
      if (err) { setWithSensitive(false); return setError(friendlyError(err)) }
      setSensitive(new Map(((data ?? []) as YouthSensitive[]).map((x) => [x.id, x])))
    })()
    return () => { cancelled = true }
  }, [withSensitive, role, rows])

  const includeSensitive = role === 'admin' && withSensitive && sensitive !== null
  const columns = [...BASE_COLUMNS, ...(includeSensitive ? SENSITIVE_COLUMNS : [])].map((k) => ({ header: k, key: k }))
  const detail = (flag: boolean | null | undefined, text: string | null | undefined) => (flag ? text || 'Yes' : yesNo(flag))

  const exportRows: Row[] = rows.map((r) => {
    const row: Row = {
      'Youth ID': r.youth_code, Name: r.full_name, Age: r.age, 'Age bracket': r.age_bracket, Sex: r.sex === 'male' ? 'Male' : 'Female',
      'Civil status': r.civil_status === 'others' ? r.civil_status_other || 'Others' : label(CIVIL_OPTIONS, r.civil_status),
      Birthdate: formatDate(r.birthdate), Purok: r.purok_name,
      Education: label(EDU_STATUS_OPTIONS, r.education_status), Level: label(EDU_LEVEL_OPTIONS, r.education_level), Course: r.course ?? '',
      Employment: label(EMPLOYMENT_OPTIONS, r.employment_status), Sector: label(SECTOR_OPTIONS, r.employment_sector),
      'Registered SK voter': yesNo(r.registered_voter), 'Youth organization': detail(r.youth_org_member, r.youth_org_name),
      Skills: r.skills.join(', '), Interests: r.interests.join(', '),
    }
    if (includeSensitive) {
      const s = sensitive?.get(r.id)
      row.Religion = s?.religion ?? ''
      row.PWD = detail(s?.has_disability, s?.disability_details)
      row['Medical condition'] = detail(s?.has_medical_condition, s?.medical_details)
    }
    return row
  })

  const filters = { purok: puroks.find((p) => p.id === purok)?.name ?? 'All', ageBracket: bracket || 'All', education: edu || 'All', employment: emp || 'All', sensitive: includeSensitive }
  const subtitle = `Purok: ${filters.purok} | Age: ${filters.ageBracket} | Education: ${filters.education} | Employment: ${filters.employment} | ${rows.length} youth`
  const osy = rows.filter((r) => r.is_osy).length
  const employed = rows.filter((r) => r.employment_status === 'employed' || r.employment_status === 'self_employed').length

  return (
    <>
    <div className="space-y-6 print:hidden">
      <Card className="!p-6 sm:!p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Purok" htmlFor="r-purok">
            <select id="r-purok" className={inputCls} value={purok} onChange={(e) => setPurok(e.target.value)}>
              <option value="">All puroks</option>{puroks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Age bracket" htmlFor="r-age">
            <select id="r-age" className={inputCls} value={bracket} onChange={(e) => setBracket(e.target.value)}>
              <option value="">All ages</option>{AGE_BRACKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Education" htmlFor="r-edu">
            <select id="r-edu" className={inputCls} value={edu} onChange={(e) => setEdu(e.target.value)}>
              <option value="">All</option>{EDU_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Employment" htmlFor="r-emp">
            <select id="r-emp" className={inputCls} value={emp} onChange={(e) => setEmp(e.target.value)}>
              <option value="">All</option>{EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      {role === 'admin' && (
        <label className="flex cursor-pointer items-start gap-3 rounded-[2rem] bg-red-50 p-5 ring-1 ring-red-200">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#dc2626]" checked={withSensitive} onChange={(e) => setWithSensitive(e.target.checked)} />
          <span className="text-sm font-bold text-red-800">
            <span className="inline-flex items-center gap-1.5 font-black"><ShieldAlert className="h-4 w-4" aria-hidden /> Include religion, disability and medical information (Admin only)</span>
            <span className="mt-1 block font-semibold">Sensitive personal information. Include it only when the program really needs it. Reading it is recorded in the audit log.</span>
          </span>
        </label>
      )}

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Youth in report" value={loading ? '...' : rows.length} tone="bg-ink text-white" />
        <StatCard label="Out of school" value={loading ? '...' : osy} tone="bg-flag text-white" />
        <StatCard label="Employed" value={loading ? '...' : employed} tone="bg-emerald-600 text-white" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-500">{rows.length > 25 ? `Showing the first 25 of ${rows.length}. Exports include all rows.` : 'Preview'}</p>
        <ExportButtons rows={exportRows} columns={columns} title="Youth profile report" subtitle={subtitle} filename="youth-report" source="youth_overview" filters={filters} printable />
      </div>

      <div className="overflow-x-auto rounded-[3rem] bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full min-w-[720px] text-left">
          <thead><tr className="border-b border-slate-100 text-xs font-black uppercase tracking-widest text-slate-400">
            <th className="px-8 py-5">Name</th><th className="px-4 py-5">Age</th><th className="px-4 py-5">Purok</th><th className="px-4 py-5">Education</th><th className="px-8 py-5">Employment</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-8 py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-8 py-10 text-center font-bold text-slate-400">No youth match these filters</td></tr>
            ) : rows.slice(0, 25).map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0">
                <td className="px-8 py-3.5 font-black">{r.last_name}, {r.first_name}</td>
                <td className="px-4 py-3.5 font-bold">{r.age}</td>
                <td className="px-4 py-3.5 font-semibold text-slate-600">{r.purok_name}</td>
                <td className="px-4 py-3.5"><EducationBadge status={r.education_status} /></td>
                <td className="px-8 py-3.5"><EmploymentBadge status={r.employment_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Print layout: plain black-on-white report with every row, shown only when printing. */}
    <section className="print-only text-black">
      <h1 className="text-2xl font-black">Youth profile report</h1>
      <p className="mt-1 text-xs font-semibold">{subtitle}</p>
      <p className="text-xs font-semibold">Generated {formatDate(new Date().toISOString())}</p>
      <div className="mt-3 flex gap-6 text-sm font-black">
        <span>Youth: {rows.length}</span><span>Out of school: {osy}</span><span>Employed: {employed}</span>
      </div>
      <table className="mt-4 w-full border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b-2 border-black font-black uppercase">
            <th className="py-1 pr-2">#</th><th className="py-1 pr-2">Name</th><th className="py-1 pr-2">Age</th><th className="py-1 pr-2">Sex</th>
            <th className="py-1 pr-2">Purok</th><th className="py-1 pr-2">Education</th><th className="py-1">Employment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-slate-300">
              <td className="py-1 pr-2">{i + 1}</td><td className="py-1 pr-2 font-bold">{r.last_name}, {r.first_name}</td><td className="py-1 pr-2">{r.age}</td>
              <td className="py-1 pr-2">{r.sex === 'male' ? 'M' : 'F'}</td><td className="py-1 pr-2">{r.purok_name}</td>
              <td className="py-1 pr-2">{label(EDU_STATUS_OPTIONS, r.education_status)}</td><td className="py-1">{label(EMPLOYMENT_OPTIONS, r.employment_status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[9px] font-semibold">Confidential. Contains personal data protected by RA 10173. Contact numbers are not included.</p>
    </section>
    </>
  )
}
