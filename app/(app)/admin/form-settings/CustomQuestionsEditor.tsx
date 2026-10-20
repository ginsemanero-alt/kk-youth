'use client'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Check, Loader2, MessageSquarePlus, Pencil, Power, PowerOff, ShieldAlert, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { friendlyError } from '@/lib/errors'
import { QUESTION_TYPES } from '@/lib/customQuestions'
import type { CustomQuestion, QuestionType } from '@/lib/types'
import { Alert, Badge, Card, Field, SectionTitle, btnDark, btnGhost, btnPrimary, inputCls, textareaCls } from '@/components/ui'

const SENSITIVE_WARNING =
  'Ang relihiyon, PWD at medical na impormasyon ay sensitibong personal na impormasyon sa ilalim ng Data Privacy Act. Ilagay lang kung kailangan talaga para sa programa at ipaliwanag sa consent form.'

interface Draft { label: string; help_text: string; question_type: QuestionType; options: string; is_required: boolean; is_sensitive: boolean }
const emptyDraft: Draft = { label: '', help_text: '', question_type: 'single_choice', options: '', is_required: false, is_sensitive: false }
const isChoice = (t: QuestionType) => t === 'single_choice' || t === 'multi_choice'
const toOptions = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

/** Create, edit, reorder and deactivate the Admin's own questions. Questions are never deleted. */
export default function CustomQuestionsEditor({ questions, onChange }: { questions: CustomQuestion[]; onChange: (next: CustomQuestion[]) => void }) {
  const router = useRouter()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editId, setEditId] = useState<string | null>(null)
  const [edit, setEdit] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fail = (m: string) => { setError(m); toast.error(m) }

  const replace = (rows: CustomQuestion[]) => {
    const map = new Map(rows.map((r) => [r.id, r]))
    const next = questions.map((q) => map.get(q.id) ?? q)
    for (const r of rows) if (!questions.some((q) => q.id === r.id)) next.push(r)
    onChange(next.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)))
    router.refresh()
  }

  const check = (d: Draft) => {
    if (!d.label.trim()) return 'Write the question first.'
    if (isChoice(d.question_type)) {
      const opts = new Set(toOptions(d.options).map((o) => o.toLowerCase()))
      if (opts.size < 2 || opts.size > 20) return 'A choice question needs 2 to 20 different options (one per line).'
    }
    return null
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const problem = check(draft)
    if (problem) return fail(problem)
    setBusy('new')
    const sort = Math.max(0, ...questions.map((q) => q.sort_order)) + 10
    const { data, error: err } = await createClient().from('custom_questions').insert({
      label: draft.label, help_text: draft.help_text || null, question_type: draft.question_type,
      options: isChoice(draft.question_type) ? toOptions(draft.options) : [], is_required: draft.is_required,
      is_sensitive: draft.is_sensitive, sort_order: sort,
    }).select('*')
    setBusy(null)
    if (err || !data?.length) return fail(err ? friendlyError(err) : 'You do not have permission to add questions.')
    replace(data as CustomQuestion[])
    setDraft(emptyDraft)
    toast.success('Question added. It now appears on the forms.')
  }

  const update = async (q: CustomQuestion, patch: Partial<CustomQuestion>, okMsg: string) => {
    setError(null)
    setBusy(q.id)
    const { data, error: err } = await createClient().from('custom_questions').update(patch).eq('id', q.id).select('*')
    setBusy(null)
    if (err || !data?.length) { fail(err ? friendlyError(err) : 'You do not have permission to change questions.'); return false }
    replace(data as CustomQuestion[])
    toast.success(okMsg)
    return true
  }

  const saveEdit = async (q: CustomQuestion) => {
    const problem = check(edit)
    if (problem) return fail(problem)
    const done = await update(q, {
      label: edit.label, help_text: edit.help_text || null, is_required: edit.is_required,
      ...(isChoice(q.question_type) ? { options: toOptions(edit.options) } : {}),
    }, 'Question saved. Answers given before stay as they were.')
    if (done) setEditId(null)
  }

  const move = async (index: number, dir: -1 | 1) => {
    const a = questions[index]
    const b = questions[index + dir]
    if (!a || !b) return
    setError(null)
    setBusy(a.id)
    const supabase = createClient()
    // Swap positions; if both had the same number, spread them apart.
    const [sa, sb] = a.sort_order === b.sort_order ? [b.sort_order + dir, a.sort_order] : [b.sort_order, a.sort_order]
    const r1 = await supabase.from('custom_questions').update({ sort_order: sa }).eq('id', a.id).select('*')
    const r2 = r1.error ? r1 : await supabase.from('custom_questions').update({ sort_order: sb }).eq('id', b.id).select('*')
    setBusy(null)
    if (r1.error || r2.error) return fail(friendlyError(r1.error ?? r2.error))
    replace([...(r1.data ?? []), ...(r2.data ?? [])] as CustomQuestion[])
  }

  const typeLabel = (t: QuestionType) => QUESTION_TYPES.find((x) => x.value === t)?.label ?? t

  return (
    <Card className="!p-6 sm:!p-8">
      <SectionTitle sub="Your own questions. They appear on the registration form, the encoder form, the profile page, reports, exports and the import template. Questions are never deleted: deactivate one to stop asking it; answers already given are kept.">
        <span className="inline-flex items-center gap-2"><MessageSquarePlus className="h-6 w-6 text-brand" aria-hidden /> Sariling mga tanong</span>
      </SectionTitle>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {questions.length === 0 ? (
        <p className="mb-6 rounded-[2rem] bg-slate-50 p-5 text-sm font-semibold text-slate-500 ring-1 ring-black/5">No questions yet. Add one below.</p>
      ) : (
        <ul className="mb-6 divide-y divide-slate-100">
          {questions.map((q, i) => (
            <li key={q.id} className={`py-4 ${q.is_active ? '' : 'opacity-60'}`}>
              {editId === q.id ? (
                <div className="space-y-3">
                  <Field label="Question" htmlFor={`eq-${q.id}`}>
                    <input id={`eq-${q.id}`} className={inputCls} value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} maxLength={200} />
                  </Field>
                  <Field label="Help text" hint="Optional" htmlFor={`eh-${q.id}`}>
                    <input id={`eh-${q.id}`} className={inputCls} value={edit.help_text} onChange={(e) => setEdit({ ...edit, help_text: e.target.value })} maxLength={300} />
                  </Field>
                  {isChoice(q.question_type) && (
                    <Field label="Options" hint="One per line. Removing an option keeps old answers." htmlFor={`eo-${q.id}`}>
                      <textarea id={`eo-${q.id}`} rows={4} className={textareaCls} value={edit.options} onChange={(e) => setEdit({ ...edit, options: e.target.value })} />
                    </Field>
                  )}
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" className="h-5 w-5 accent-[#1d4ed8]" checked={edit.is_required} onChange={(e) => setEdit({ ...edit, is_required: e.target.checked })} /> Required
                  </label>
                  <p className="text-xs font-semibold text-slate-400">The type ({typeLabel(q.question_type)}) and the sensitive setting cannot be changed. Deactivate this question and add a new one instead.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => saveEdit(q)} disabled={busy !== null} className={btnDark}>{busy === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save</button>
                    <button type="button" onClick={() => setEditId(null)} className={btnGhost}><X className="h-4 w-4" /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black">{q.label}</span>
                      <Badge tone="slate">{typeLabel(q.question_type)}</Badge>
                      {q.is_required && q.is_active && <Badge tone="blue">Required</Badge>}
                      {q.is_sensitive && <Badge tone="red">Sensitibo</Badge>}
                      {!q.is_active && <Badge tone="ink">Inactive</Badge>}
                    </div>
                    {q.help_text && <p className="mt-1 text-xs font-semibold text-slate-500">{q.help_text}</p>}
                    {q.options.length > 0 && <p className="mt-1 text-xs font-semibold text-slate-400">{q.options.join(' / ')}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" aria-label="Move up" title="Move up" disabled={busy !== null || i === 0} onClick={() => move(i, -1)} className={`${btnGhost} !px-3`}><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label="Move down" title="Move down" disabled={busy !== null || i === questions.length - 1} onClick={() => move(i, 1)} className={`${btnGhost} !px-3`}><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" disabled={busy !== null} onClick={() => { setEditId(q.id); setEdit({ label: q.label, help_text: q.help_text ?? '', question_type: q.question_type, options: q.options.join('\n'), is_required: q.is_required, is_sensitive: q.is_sensitive }) }} className={`${btnGhost} !px-4`}><Pencil className="h-4 w-4" /> Edit</button>
                    {q.is_active ? (
                      <button type="button" disabled={busy !== null} onClick={() => update(q, { is_active: false }, 'Question deactivated. Saved answers are kept.')} className={`${btnGhost} !px-4 !text-flag`}><PowerOff className="h-4 w-4" /> Deactivate</button>
                    ) : (
                      <button type="button" disabled={busy !== null} onClick={() => update(q, { is_active: true }, 'Question is active again.')} className={`${btnGhost} !px-4`}><Power className="h-4 w-4" /> Activate</button>
                    )}
                    {busy === q.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={create} className="space-y-4 rounded-[2.5rem] bg-slate-50 p-6 ring-1 ring-black/5" noValidate>
        <div className="text-sm font-black uppercase tracking-widest text-brand">New question</div>
        <Field label="Question" htmlFor="nq-label">
          <input id="nq-label" className={inputCls} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} maxLength={200} placeholder="e.g. T-shirt size for the sportsfest" />
        </Field>
        <Field label="Help text" hint="Optional" htmlFor="nq-help">
          <input id="nq-help" className={inputCls} value={draft.help_text} onChange={(e) => setDraft({ ...draft, help_text: e.target.value })} maxLength={300} />
        </Field>
        <Field label="Type of answer" htmlFor="nq-type">
          <select id="nq-type" className={inputCls} value={draft.question_type} onChange={(e) => setDraft({ ...draft, question_type: e.target.value as QuestionType })}>
            {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        {isChoice(draft.question_type) && (
          <Field label="Options" hint="One per line, 2 to 20" htmlFor="nq-options">
            <textarea id="nq-options" rows={4} className={textareaCls} value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} placeholder={'Small\nMedium\nLarge'} />
          </Field>
        )}
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="h-5 w-5 accent-[#1d4ed8]" checked={draft.is_required} onChange={(e) => setDraft({ ...draft, is_required: e.target.checked })} /> Required
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-red-800">
            <input type="checkbox" className="h-5 w-5 accent-[#dc2626]" checked={draft.is_sensitive} onChange={(e) => setDraft({ ...draft, is_sensitive: e.target.checked })} /> Sensitibo
          </label>
        </div>
        {draft.is_sensitive && (
          <p className="flex items-start gap-2 rounded-[1.5rem] bg-red-50 p-4 text-sm font-bold text-red-800 ring-1 ring-red-200">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-flag" aria-hidden />
            <span>{SENSITIVE_WARNING} Sensitive answers are seen only by the Admin and encoders, exported only by an Admin, and never written to the audit log. This cannot be changed after the question is created.</span>
          </p>
        )}
        <button type="submit" disabled={busy !== null} className={btnPrimary}>
          {busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />} Add question
        </button>
      </form>
    </Card>
  )
}
