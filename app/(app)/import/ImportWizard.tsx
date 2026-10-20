'use client'
import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { exportWorkbook, readFirstSheet, type Row } from '@/lib/export'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { ageOn, toList } from '@/lib/format'
import { CIVIL_OPTIONS, EDU_LEVEL_OPTIONS, EDU_STATUS_OPTIONS, EMPLOYMENT_OPTIONS, SECTOR_OPTIONS, SEX_OPTIONS } from '@/lib/constants'
import { anySensitiveShown, fieldApplies, required, shown, toRules, type FormRules } from '@/lib/formSettings'
import type { FormFieldSetting } from '@/lib/types'
import { Alert, Card, SectionTitle, StatCard, btnDark, btnGhost, btnPrimary } from '@/components/ui'

const MAX_ROWS = 2000
const CHUNK = 200

interface Parsed { line: number; name: string; payload: Record<string, unknown> | null; error: string | null }
interface Failure { line: number; name: string; error: string }

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')

function pickEnum(raw: unknown, options: { value: string; label: string }[], extra: Record<string, string> = {}): string | null {
  const n = norm(raw)
  if (!n) return ''
  if (extra[n]) return extra[n]
  const hit = options.find((o) => o.value === n || norm(o.label) === n)
  return hit ? hit.value : null
}

/** '' when blank, 'yes' / 'no', or null when not recognized. */
function pickYesNo(raw: unknown): string | null {
  const n = norm(raw)
  if (!n) return ''
  if (['yes', 'y', 'true', '1', 'oo'].includes(n)) return 'yes'
  if (['no', 'n', 'false', '0', 'hindi'].includes(n)) return 'no'
  return null
}

function parseDate(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return null
}

/** Optional columns, in template order. A sub-column follows the field named in "parent". */
type Kind = 'text' | 'list' | 'yesno' | 'enum' | 'phone'
const OPTIONAL: { key: string; kind: Kind; parent?: string; options?: { value: string; label: string }[]; max?: number }[] = [
  { key: 'middle_name', kind: 'text', max: 80 },
  { key: 'suffix', kind: 'text', max: 10 },
  { key: 'civil_status', kind: 'enum', options: CIVIL_OPTIONS },
  { key: 'civil_status_other', kind: 'text', parent: 'civil_status', max: 60 },
  { key: 'contact_number', kind: 'phone' },
  { key: 'email', kind: 'text', max: 120 },
  { key: 'registered_voter', kind: 'yesno' },
  { key: 'religion', kind: 'text', max: 60 },
  { key: 'education_level', kind: 'enum', options: EDU_LEVEL_OPTIONS },
  { key: 'course', kind: 'text', max: 120 },
  { key: 'out_of_school_reason', kind: 'text', max: 200 },
  { key: 'employment_status', kind: 'enum', options: EMPLOYMENT_OPTIONS },
  { key: 'employment_sector', kind: 'enum', options: SECTOR_OPTIONS },
  { key: 'government_agency', kind: 'text', max: 120 },
  { key: 'employment_duration', kind: 'text', max: 60 },
  { key: 'has_disability', kind: 'yesno' },
  { key: 'disability_details', kind: 'text', parent: 'has_disability', max: 200 },
  { key: 'has_medical_condition', kind: 'yesno' },
  { key: 'medical_details', kind: 'text', parent: 'has_medical_condition', max: 200 },
  { key: 'youth_org_member', kind: 'yesno' },
  { key: 'youth_org_name', kind: 'text', parent: 'youth_org_member', max: 120 },
  { key: 'skills', kind: 'list' },
  { key: 'interests', kind: 'list' },
  { key: 'civic_involvement', kind: 'list' },
]

/** Template columns: the core fields, then every optional field the form settings show. */
const columnsFor = (rules: FormRules) => [
  'first_name', 'last_name', 'birthdate', 'sex', 'purok', 'education_status',
  ...OPTIONAL.filter((c) => shown(rules, c.parent ?? c.key)).map((c) => c.key),
  'guardian_name', 'guardian_relationship',
]

function parseRow(r: Record<string, unknown>, line: number, puroks: string[], rules: FormRules): Parsed {
  const get = (k: string) => String(r[k] ?? '').trim()
  const name = `${get('first_name')} ${get('last_name')}`.trim() || '(no name)'
  const fail = (error: string): Parsed => ({ line, name, payload: null, error })

  if (!get('first_name')) return fail('first_name is required')
  if (!get('last_name')) return fail('last_name is required')
  const birthdate = parseDate(r.birthdate)
  if (!birthdate || Number.isNaN(Date.parse(birthdate))) return fail('birthdate must look like 2002-05-31 or 05/31/2002')
  const age = ageOn(birthdate)
  if (age < 15 || age > 30) return fail(`age ${age} is outside 15 to 30`)

  const sex = pickEnum(r.sex, SEX_OPTIONS, { m: 'male', f: 'female' })
  if (!sex) return fail('sex must be male or female')
  const purok = puroks.find((p) => p.trim().toLowerCase() === get('purok').toLowerCase())
  if (!purok) return fail(`purok "${get('purok')}" does not exist (see the Allowed values sheet)`)
  const edu = pickEnum(r.education_status, EDU_STATUS_OPTIONS, { osy: 'out_of_school', 'out_of_school_youth': 'out_of_school' })
  if (!edu) return fail('education_status must be in_school, out_of_school or graduated')

  const payload: Record<string, unknown> = {
    first_name: get('first_name'), last_name: get('last_name'), birthdate, sex, purok, education_status: edu,
    guardian_name: get('guardian_name'), guardian_relationship: get('guardian_relationship'),
  }
  // Parse every shown optional column; hidden ones are ignored (the database drops them too).
  for (const c of OPTIONAL) {
    if (!shown(rules, c.parent ?? c.key)) continue
    const raw = get(c.key)
    if (c.kind === 'enum') {
      const v = pickEnum(raw, c.options ?? [])
      if (v === null) return fail(`${c.key} is not recognized (see the Allowed values sheet)`)
      payload[c.key] = v
    } else if (c.kind === 'yesno') {
      const v = pickYesNo(raw)
      if (v === null) return fail(`${c.key} must be yes or no`)
      payload[c.key] = v
    } else if (c.kind === 'list') {
      payload[c.key] = toList(raw)
    } else if (c.kind === 'phone') {
      const phone = raw.replace(/[\s-]/g, '')
      if (phone && !/^(\+63|0)9\d{9}$/.test(phone)) return fail('contact_number must be a mobile number like 09171234567')
      payload[c.key] = phone
    } else {
      if (c.max && raw.length > c.max) return fail(`${c.key} is longer than ${c.max} characters`)
      payload[c.key] = raw
    }
  }

  const answers = {
    education_level: String(payload.education_level ?? ''), education_status: edu,
    employment_status: String(payload.employment_status ?? ''), employment_sector: String(payload.employment_sector ?? ''),
  }
  for (const c of OPTIONAL) {
    if (c.parent || !required(rules, c.key) || !fieldApplies(c.key, answers)) continue
    const v = payload[c.key]
    if (Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim()) return fail(`${c.key} is required by the form settings`)
  }
  const email = String(payload.email ?? '')
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('email is not a valid email address')
  if (payload.youth_org_member === 'yes' && !String(payload.youth_org_name ?? '').trim()) return fail('youth_org_name is required when youth_org_member is yes')
  if (age < 18 && !get('guardian_name')) return fail('guardian_name is required for youth below 18')

  return { line, name, error: null, payload }
}

export default function ImportWizard({ puroks, settings }: { puroks: string[]; settings: FormFieldSetting[] }) {
  const rules = useMemo(() => toRules(settings), [settings])
  const input = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Parsed[]>([])
  const [attest, setAttest] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const fail = (m: string) => { setError(m); toast.error(m) }
  const [result, setResult] = useState<{ imported: number; failures: Failure[] } | null>(null)

  const valid = rows.filter((r) => r.payload)
  const invalid = rows.filter((r) => !r.payload)
  const columns = columnsFor(rules)
  const requiredCols = OPTIONAL.filter((c) => !c.parent && required(rules, c.key)).map((c) => c.key)

  const template = () => {
    const sample: Record<string, string> = {
      first_name: 'Juan', middle_name: 'Santos', last_name: 'Dela Cruz', suffix: '', birthdate: '2003-06-15', sex: 'male',
      civil_status: 'single', civil_status_other: '', purok: puroks[0] ?? 'Purok 1', contact_number: '09171234567', email: 'juan@example.com',
      registered_voter: 'yes', religion: '', education_status: 'out_of_school', education_level: 'senior_high', course: '',
      out_of_school_reason: 'financial problem', employment_status: 'unemployed', employment_sector: '', government_agency: '', employment_duration: '',
      has_disability: '', disability_details: '', has_medical_condition: '', medical_details: '', youth_org_member: 'no', youth_org_name: '',
      skills: 'carpentry, welding', interests: 'basketball', civic_involvement: 'SK activities', guardian_name: '', guardian_relationship: '',
    }
    const example: Row = Object.fromEntries(columns.map((k) => [k, sample[k] ?? '']))
    const list = (o: { value: string }[]) => o.map((x) => x.value)
    const lists: [string, string[]][] = [
      ['purok', puroks], ['sex', list(SEX_OPTIONS)], ['education_status', list(EDU_STATUS_OPTIONS)],
      ...OPTIONAL.filter((c) => shown(rules, c.parent ?? c.key) && (c.kind === 'enum' || c.kind === 'yesno'))
        .map((c): [string, string[]] => [c.key, c.kind === 'yesno' ? ['yes', 'no'] : list(c.options ?? [])]),
    ]
    const max = Math.max(...lists.map(([, l]) => l.length))
    const allowed: string[][] = [lists.map(([k]) => k)]
    for (let i = 0; i < max; i++) allowed.push(lists.map(([, l]) => l[i] ?? ''))
    const notes: string[][] = [
      ['Column', 'Required?'],
      ...columns.map((k) => [k, ['first_name', 'last_name', 'birthdate', 'sex', 'purok', 'education_status'].includes(k) || requiredCols.includes(k) ? 'Required' : k === 'guardian_name' ? 'Required below 18' : 'Optional']),
    ]
    exportWorkbook([{ name: 'Youth', rows: [example] }, { name: 'Allowed values', rows: allowed }, { name: 'Columns', rows: notes }], 'youth-import-template.xlsx')
  }

  const onFile = async (file: File) => {
    setError(null); setResult(null); setRows([]); setAttest(false)
    if (file.size > 5 * 1024 * 1024) return fail('The file must be 5 MB or smaller.')
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return fail('Upload an .xlsx, .xls or .csv file.')
    try {
      const json = await readFirstSheet(file)
      if (json.length === 0) return fail('The first sheet has no data rows.')
      if (json.length > MAX_ROWS) return fail(`Too many rows (${json.length}). Import at most ${MAX_ROWS} at a time.`)
      const keys = Object.keys(json[0]).map((k) => k.trim().toLowerCase())
      const missing = ['first_name', 'last_name', 'birthdate', 'sex', 'purok', 'education_status'].filter((h) => !keys.includes(h))
      if (missing.length) return fail(`Missing column(s): ${missing.join(', ')}. Download the template to see the expected headers.`)
      const cleaned = json.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v])))
      setFileName(file.name)
      setRows(cleaned.map((r, i) => parseRow(r, i + 2, puroks, rules)))
    } catch {
      setError('This file could not be read. Make sure it is a valid Excel or CSV file.')
    }
  }

  const run = async () => {
    setError(null); setBusy(true); setProgress(0)
    const supabase = createClient()
    const failures: Failure[] = invalid.map((r) => ({ line: r.line, name: r.name, error: r.error ?? '' }))
    let imported = 0
    try {
      for (let i = 0; i < valid.length; i += CHUNK) {
        const chunk = valid.slice(i, i + CHUNK)
        const { data, error: err } = await supabase.rpc('import_youth', { p_rows: chunk.map((c) => c.payload) })
        if (err) throw err
        const res = data as { imported: number; results: { row: number; ok: boolean; error?: string }[] }
        imported += res.imported
        res.results.forEach((x) => { if (!x.ok) failures.push({ line: chunk[x.row - 1].line, name: chunk[x.row - 1].name, error: x.error ?? 'Unknown error' }) })
        setProgress(Math.min(valid.length, i + CHUNK))
      }
      failures.sort((a, b) => a.line - b.line)
      setResult({ imported, failures })
      setRows([])
    } catch (e) {
      fail(friendlyError(e as { message?: string }))
    } finally {
      setBusy(false)
    }
  }

  const errorReport = (failures: Failure[]) =>
    exportWorkbook([{ name: 'Import errors', rows: failures.map((f) => ({ 'Excel row': f.line, Name: f.name, Problem: f.error })) }], 'import-error-report.xlsx')

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle sub="Use the template so the columns match. Dates as 2002-05-31. Skills and interests separated by commas. Yes/no columns take yes or no.">Step 1: get the template</SectionTitle>
        <p className="mb-4 text-sm font-semibold text-slate-500">
          The columns follow the current form settings.
          {requiredCols.length > 0 && <> Also required: <span className="font-black text-ink">{requiredCols.join(', ')}</span>.</>}
        </p>
        <button onClick={template} className={btnGhost}><Download className="h-4 w-4" /> Download template (.xlsx)</button>
      </Card>

      <Card>
        <SectionTitle sub="Excel (.xlsx, .xls) or CSV, up to 2000 rows and 5 MB">Step 2: choose your file</SectionTitle>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label="Import file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
        <button onClick={() => input.current?.click()} disabled={busy} className={btnPrimary}><Upload className="h-4 w-4" /> Choose file</button>
        {fileName && rows.length > 0 && <span className="ml-3 text-sm font-bold text-slate-500"><FileSpreadsheet className="mr-1 inline h-4 w-4" />{fileName}</span>}
        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </Card>

      {rows.length > 0 && (
        <Card>
          <SectionTitle>Step 3: review and import</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Rows read" value={rows.length} tone="bg-ink text-white" />
            <StatCard label="Ready to import" value={valid.length} tone="bg-emerald-600 text-white" />
            <StatCard label="Need fixing" value={invalid.length} tone="bg-flag text-white" />
          </div>
          {invalid.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 flex items-center gap-2 text-sm font-black text-rose-700"><AlertTriangle className="h-4 w-4" /> Rows with problems will be skipped</p>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-[2rem] bg-rose-50 p-5 text-sm font-semibold text-rose-800">
                {invalid.slice(0, 100).map((r) => <li key={r.line}>Row {r.line} ({r.name}): {r.error}</li>)}
                {invalid.length > 100 && <li>... and {invalid.length - 100} more (see the error report)</li>}
              </ul>
              <button onClick={() => errorReport(invalid.map((r) => ({ line: r.line, name: r.name, error: r.error ?? '' })))} className={`${btnGhost} mt-3`}><Download className="h-4 w-4" /> Error report</button>
            </div>
          )}
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-[2rem] bg-slate-50 p-5 ring-1 ring-black/5">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[#1d4ed8]" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
            <span className="text-sm font-bold">
              I confirm that signed data privacy consent forms are on file for these youth, including parent or guardian consent for those below 18
              {anySensitiveShown(rules) ? ', and that rows with religion, disability or medical information have the consent version that covers sensitive information' : ''}.
            </span>
          </label>
          <button onClick={run} disabled={busy || !attest || valid.length === 0} className={`${btnDark} mt-5`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? `Importing ${progress} of ${valid.length}` : `Import ${valid.length} row${valid.length === 1 ? '' : 's'}`}
          </button>
        </Card>
      )}

      {result && (
        <Card>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <h2 className="text-3xl font-black tracking-tight">{result.imported} imported, {result.failures.length} skipped</h2>
          </div>
          {result.failures.length > 0 && (
            <>
              <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto rounded-[2rem] bg-rose-50 p-5 text-sm font-semibold text-rose-800">
                {result.failures.slice(0, 100).map((f) => <li key={`${f.line}-${f.error}`}>Row {f.line} ({f.name}): {f.error}</li>)}
              </ul>
              <button onClick={() => errorReport(result.failures)} className={`${btnGhost} mt-3`}><Download className="h-4 w-4" /> Download error report</button>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
