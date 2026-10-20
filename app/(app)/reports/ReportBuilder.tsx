'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ListChecks, Loader2, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ExportButtons from '@/components/ExportButtons'
import { AGE_BRACKETS, EDU_LEVEL_OPTIONS, EDU_STATUS_OPTIONS, EMPLOYMENT_OPTIONS, CIVIL_OPTIONS, SECTOR_OPTIONS, label, yesNo } from '@/lib/constants'
import { answerChoices, formatAnswer, isCountable } from '@/lib/customQuestions'
import { friendlyError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import type { Row } from '@/lib/export'
import type { CustomAnswers, CustomQuestion, Role, YouthCustomAnswers, YouthOverview, YouthSensitive } from '@/lib/types'
import { Alert, Badge, Card, EducationBadge, EmploymentBadge, Field, SectionTitle, StatCard, inputCls } from '@/components/ui'

// Email and contact numbers are never exported (data minimization).
const BASE_COLUMNS = [
  'Youth ID', 'Name', 'Age', 'Age bracket', 'Sex', 'Civil status', 'Birthdate', 'Purok', 'Education', 'Level', 'Course',
  'Employment', 'Sector', 'Registered SK voter', 'Youth organization', 'Skills', 'Interests',
]
const SENSITIVE_COLUMNS = ['Religion', 'PWD', 'Medical condition']
const qHeader = (q: CustomQuestion) => `Q: ${q.label}`
const NOT_ANSWERED = 'Not answered'

export default function ReportBuilder({ puroks, role, questions }: { puroks: { id: string; name: string }[]; role: Role; questions: CustomQuestion[] }) {
  const [purok, setPurok] = useState('')
  const [bracket, setBracket] = useState('')
  const [edu, setEdu] = useState('')
  const [emp, setEmp] = useState('')
  const [qFilter, setQFilter] = useState('')
  const [aFilter, setAFilter] = useState('')
  const [rows, setRows] = useState<YouthOverview[]>([])
  const [answers, setAnswers] = useState<Map<string, CustomAnswers>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Admin only: the database refuses these reads for every other role, and they are logged.
  const [withSensitive, setWithSensitive] = useState(false)
  const [sensitive, setSensitive] = useState<Map<string, YouthSensitive> | null>(null)
  const [sensitiveAnswers, setSensitiveAnswers] = useState<Map<string, CustomAnswers> | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    let q = supabase.from('youth_overview').select('*').is('deleted_at', null)
    if (purok) q = q.eq('purok_id', purok)
    if (bracket) q = q.eq('age_bracket', bracket)
    if (edu) q = q.eq('education_status', edu)
    if (emp) q = q.eq('employment_status', emp)
    const [{ data, error: err }, { data: ans }] = await Promise.all([
      q.order('last_name').order('first_name').limit(5000),
      // Non-sensitive answers (the view hides the rest); empty if 06 is not run yet.
      questions.length ? supabase.from('youth_custom_answers').select('id, answers').limit(10000) : Promise.resolve({ data: [] }),
    ])
    setLoading(false)
    if (err) return setError(friendlyError(err))
    setRows((data ?? []) as YouthOverview[])
    setAnswers(new Map(((ans ?? []) as Pick<YouthCustomAnswers, 'id' | 'answers'>[]).map((x) => [x.id, x.answers ?? {}])))
  }, [purok, bracket, edu, emp, questions.length])

  useEffect(() => { void run() }, [run])

  useEffect(() => {
    setSensitive(null)
    setSensitiveAnswers(null)
    if (!withSensitive || role !== 'admin' || rows.length === 0) return
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const ids = rows.map((r) => r.id)
      const [fields, extra] = await Promise.all([
        supabase.rpc('get_youth_sensitive_bulk', { p_ids: ids }),
        questions.some((q) => q.is_sensitive) ? supabase.rpc('get_sensitive_answers_bulk', { p_ids: ids }) : Promise.resolve({ data: [], error: null }),
      ])
      if (cancelled) return
      const err = fields.error ?? extra.error
      if (err) { setWithSensitive(false); return setError(friendlyError(err)) }
      setSensitive(new Map(((fields.data ?? []) as YouthSensitive[]).map((x) => [x.id, x])))
      setSensitiveAnswers(new Map(((extra.data ?? []) as { id: string; sensitive_answers: CustomAnswers }[]).map((x) => [x.id, x.sensitive_answers ?? {}])))
    })()
    return () => { cancelled = true }
  }, [withSensitive, role, rows, questions])

  const includeSensitive = role === 'admin' && withSensitive && sensitive !== null
  // Sensitive questions are reported only when an Admin includes sensitive information.
  const reportQuestions = questions.filter((q) => q.is_active && (!q.is_sensitive || includeSensitive))
  const answerOf = useCallback(
    (id: string, q: CustomQuestion) => (q.is_sensitive ? sensitiveAnswers?.get(id)?.[q.id] : answers.get(id)?.[q.id]),
    [answers, sensitiveAnswers],
  )

  const filterQuestion = reportQuestions.find((q) => q.id === qFilter && isCountable(q))
  const shown = useMemo(() => {
    if (!filterQuestion || !aFilter) return rows
    return rows.filter((r) => (formatAnswer(answerOf(r.id, filterQuestion)) || NOT_ANSWERED) === aFilter)
  }, [rows, filterQuestion, aFilter, answerOf])

  const counts = reportQuestions.filter(isCountable).map((q) => {
    const tally = new Map<string, number>([...answerChoices(q), NOT_ANSWERED].map((c) => [c, 0]))
    for (const r of shown) {
      const a = formatAnswer(answerOf(r.id, q)) || NOT_ANSWERED
      tally.set(a, (tally.get(a) ?? 0) + 1) // an option removed later still counts
    }
    return { q, tally: [...tally.entries()] }
  })

  const columns = [
    ...BASE_COLUMNS, ...(includeSensitive ? SENSITIVE_COLUMNS : []), ...reportQuestions.map(qHeader),
  ].map((k) => ({ header: k, key: k }))
  const detail = (flag: boolean | null | undefined, text: string | null | undefined) => (flag ? text || 'Yes' : yesNo(flag))

  const exportRows: Row[] = shown.map((r) => {
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
    for (const q of reportQuestions) row[qHeader(q)] = formatAnswer(answerOf(r.id, q))
    return row
  })

  const filters = {
    purok: puroks.find((p) => p.id === purok)?.name ?? 'All', ageBracket: bracket || 'All', education: edu || 'All', employment: emp || 'All',
    question: filterQuestion && aFilter ? `${filterQuestion.label} = ${aFilter}` : 'All', sensitive: includeSensitive,
  }
  const subtitle = `Purok: ${filters.purok} | Age: ${filters.ageBracket} | Education: ${filters.education} | Employment: ${filters.employment}${filters.question !== 'All' ? ` | ${filters.question}` : ''} | ${shown.length} youth`
  const osy = shown.filter((r) => r.is_osy).length
  const employed = shown.filter((r) => r.employment_status === 'employed' || r.employment_status === 'self_employed').length
  const countable = reportQuestions.filter(isCountable)

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
          {countable.length > 0 && (
            <>
              <Field label="SK question" htmlFor="r-question">
                <select id="r-question" className={inputCls} value={qFilter} onChange={(e) => { setQFilter(e.target.value); setAFilter('') }}>
                  <option value="">Any answer</option>{countable.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
                </select>
              </Field>
              <Field label="Answer" htmlFor="r-answer">
                <select id="r-answer" className={inputCls} value={aFilter} onChange={(e) => setAFilter(e.target.value)} disabled={!filterQuestion}>
                  <option value="">All</option>
                  {filterQuestion && [...answerChoices(filterQuestion), NOT_ANSWERED].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </>
          )}
        </div>
      </Card>

      {role === 'admin' && (
        <label className="flex cursor-pointer items-start gap-3 rounded-[2rem] bg-red-50 p-5 ring-1 ring-red-200">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#dc2626]" checked={withSensitive} onChange={(e) => setWithSensitive(e.target.checked)} />
          <span className="text-sm font-bold text-red-800">
            <span className="inline-flex items-center gap-1.5 font-black"><ShieldAlert className="h-4 w-4" aria-hidden /> Include religion, disability, medical and sensitive question answers (Admin only)</span>
            <span className="mt-1 block font-semibold">Sensitive personal information. Include it only when the program really needs it. Reading it is recorded in the audit log.</span>
          </span>
        </label>
      )}

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Youth in report" value={loading ? '...' : shown.length} tone="bg-ink text-white" />
        <StatCard label="Out of school" value={loading ? '...' : osy} tone="bg-flag text-white" />
        <StatCard label="Employed" value={loading ? '...' : employed} tone="bg-emerald-600 text-white" />
      </div>

      {counts.length > 0 && !loading && (
        <Card className="!p-6 sm:!p-8">
          <SectionTitle sub="Count per answer for the youth in this report">
            <span className="inline-flex items-center gap-2"><ListChecks className="h-6 w-6 text-brand" aria-hidden /> SK questions</span>
          </SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {counts.map(({ q, tally }) => (
              <div key={q.id} className={`rounded-[2rem] p-5 ring-1 ${q.is_sensitive ? 'bg-red-50 ring-red-200' : 'bg-slate-50 ring-black/5'}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2 font-black">
                  {q.label}
                  {q.is_sensitive && <Badge tone="red">Sensitive</Badge>}
                </div>
                <ul className="space-y-1.5 text-sm font-semibold">
                  {tally.map(([choice, n]) => (
                    <li key={choice} className="flex items-center justify-between gap-3">
                      <span className={choice === NOT_ANSWERED ? 'text-slate-400' : ''}>{choice}</span>
                      <span className="rounded-full bg-white px-3 py-0.5 font-black ring-1 ring-black/5">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-500">{shown.length > 25 ? `Showing the first 25 of ${shown.length}. Exports include all rows.` : 'Preview'}</p>
        <ExportButtons rows={exportRows} columns={columns} title="Youth profile report" subtitle={subtitle} filename="youth-report" source="youth_overview" filters={filters} printable />
      </div>

      <div className="overflow-x-auto rounded-[3rem] bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full min-w-[720px] text-left">
          <thead><tr className="border-b border-slate-100 text-xs font-black uppercase tracking-widest text-slate-400">
            <th className="px-8 py-5">Name</th><th className="px-4 py-5">Age</th><th className="px-4 py-5">Purok</th><th className="px-4 py-5">Education</th><th className="px-4 py-5">Employment</th>
            {reportQuestions.length > 0 && <th className="px-8 py-5">SK questions</th>}</tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-8 py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={6} className="px-8 py-10 text-center font-bold text-slate-400">No youth match these filters</td></tr>
            ) : shown.slice(0, 25).map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0">
                <td className="px-8 py-3.5 font-black">{r.last_name}, {r.first_name}</td>
                <td className="px-4 py-3.5 font-bold">{r.age}</td>
                <td className="px-4 py-3.5 font-semibold text-slate-600">{r.purok_name}</td>
                <td className="px-4 py-3.5"><EducationBadge status={r.education_status} /></td>
                <td className="px-4 py-3.5"><EmploymentBadge status={r.employment_status} /></td>
                {reportQuestions.length > 0 && (
                  <td className="max-w-xs px-8 py-3.5 text-xs font-semibold text-slate-600">
                    {reportQuestions.filter((q) => answerOf(r.id, q) !== undefined).map((q) => `${q.label}: ${formatAnswer(answerOf(r.id, q))}`).join(' / ')}
                  </td>
                )}
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
        <span>Youth: {shown.length}</span><span>Out of school: {osy}</span><span>Employed: {employed}</span>
      </div>
      {counts.length > 0 && (
        <div className="mt-3 text-[10px]">
          {counts.map(({ q, tally }) => (
            <p key={q.id}><span className="font-black">{q.label}:</span> {tally.map(([c, n]) => `${c} ${n}`).join(', ')}</p>
          ))}
        </div>
      )}
      <table className="mt-4 w-full border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b-2 border-black font-black uppercase">
            <th className="py-1 pr-2">#</th><th className="py-1 pr-2">Name</th><th className="py-1 pr-2">Age</th><th className="py-1 pr-2">Sex</th>
            <th className="py-1 pr-2">Purok</th><th className="py-1 pr-2">Education</th><th className="py-1">Employment</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
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
