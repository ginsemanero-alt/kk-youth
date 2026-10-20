'use client'
import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { exportWorkbook, readFirstSheet, type Row } from '@/lib/export'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { ageOn, toList } from '@/lib/format'
import { CIVIL_OPTIONS, EDU_LEVEL_OPTIONS, EDU_STATUS_OPTIONS, EMPLOYMENT_OPTIONS, SEX_OPTIONS } from '@/lib/constants'
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

function parseDate(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return null
}

function parseRow(r: Record<string, unknown>, line: number, puroks: string[]): Parsed {
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
  const civil = pickEnum(r.civil_status, CIVIL_OPTIONS)
  if (civil === null) return fail('civil_status is not recognized')
  const purok = puroks.find((p) => p.trim().toLowerCase() === get('purok').toLowerCase())
  if (!purok) return fail(`purok "${get('purok')}" does not exist (see the Allowed values sheet)`)
  const edu = pickEnum(r.education_status, EDU_STATUS_OPTIONS, { osy: 'out_of_school', 'out_of_school_youth': 'out_of_school' })
  if (!edu) return fail('education_status must be in_school, out_of_school or graduated')
  const level = pickEnum(r.education_level, EDU_LEVEL_OPTIONS)
  if (level === null) return fail('education_level is not recognized')
  const emp = pickEnum(r.employment_status, EMPLOYMENT_OPTIONS)
  if (emp === null) return fail('employment_status is not recognized')
  const phone = get('contact_number').replace(/[\s-]/g, '')
  if (phone && !/^(\+63|0)9\d{9}$/.test(phone)) return fail('contact_number must be a mobile number like 09171234567')
  if (age < 18 && !get('guardian_name')) return fail('guardian_name is required for youth below 18')

  return {
    line, name, error: null,
    payload: {
      first_name: get('first_name'), middle_name: get('middle_name'), last_name: get('last_name'), suffix: get('suffix'),
      birthdate, sex, civil_status: civil || 'single', purok, contact_number: phone,
      education_status: edu, education_level: level, employment_status: emp || 'unemployed',
      skills: toList(get('skills')), interests: toList(get('interests')), civic_involvement: toList(get('civic_involvement')),
      guardian_name: get('guardian_name'), guardian_relationship: get('guardian_relationship'),
    },
  }
}

export default function ImportWizard({ puroks }: { puroks: string[] }) {
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

  const template = () => {
    const example: Row = {
      first_name: 'Juan', middle_name: 'Santos', last_name: 'Dela Cruz', suffix: '', birthdate: '2003-06-15', sex: 'male', civil_status: 'single',
      purok: puroks[0] ?? 'Purok 1', contact_number: '09171234567', education_status: 'out_of_school', education_level: 'senior_high',
      employment_status: 'unemployed', skills: 'carpentry, welding', interests: 'basketball', civic_involvement: 'SK activities', guardian_name: '', guardian_relationship: '',
    }
    const list = (o: { value: string }[]) => o.map((x) => x.value)
    const max = Math.max(puroks.length, 7)
    const allowed: string[][] = [['purok', 'sex', 'civil_status', 'education_status', 'education_level', 'employment_status']]
    for (let i = 0; i < max; i++) {
      allowed.push([puroks[i] ?? '', list(SEX_OPTIONS)[i] ?? '', list(CIVIL_OPTIONS)[i] ?? '', list(EDU_STATUS_OPTIONS)[i] ?? '', list(EDU_LEVEL_OPTIONS)[i] ?? '', list(EMPLOYMENT_OPTIONS)[i] ?? ''])
    }
    exportWorkbook([{ name: 'Youth', rows: [example] }, { name: 'Allowed values', rows: allowed }], 'youth-import-template.xlsx')
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
      setRows(cleaned.map((r, i) => parseRow(r, i + 2, puroks)))
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
        <SectionTitle sub="Use the template so the columns match. Dates as 2002-05-31. Skills and interests separated by commas.">Step 1: get the template</SectionTitle>
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
            <span className="text-sm font-bold">I confirm that signed data privacy consent forms are on file for these youth, including parent or guardian consent for those below 18.</span>
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
