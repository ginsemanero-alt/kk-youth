'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { inputCls } from '@/components/ui'

export default function TagInput({ id, value, onChange, suggestions = [], placeholder }: {
  id?: string
  value: string[]
  onChange: (v: string[]) => void
  suggestions?: string[]
  placeholder?: string
}) {
  const [text, setText] = useState('')

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase()
    if (!t || value.includes(t) || value.length >= 30) return
    onChange([...value, t.slice(0, 40)])
    setText('')
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          id={id}
          className={inputCls}
          value={text}
          placeholder={placeholder ?? 'Type and press Enter'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(text)
            }
          }}
        />
        <button type="button" onClick={() => add(text)} aria-label="Add" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white hover:bg-brand-deep">
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-1.5 pl-3.5 pr-2 text-xs font-black text-brand-deep">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.filter((s) => !value.includes(s)).slice(0, 8).map((s) => (
            <button type="button" key={s} onClick={() => add(s)} className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-bold text-slate-500 hover:border-brand hover:text-brand">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
