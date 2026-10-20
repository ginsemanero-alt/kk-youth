'use client'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, TriangleAlert, X } from 'lucide-react'

type ToastTone = 'success' | 'error'
interface ToastItem { id: number; tone: ToastTone; text: string }
interface ToastApi { success: (text: string) => void; error: (text: string) => void }

const ToastContext = createContext<ToastApi | null>(null)

/** Short-lived message for the result of an action (saved, approved, failed). Errors stay longer. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])
  const push = useCallback((tone: ToastTone, text: string) => {
    const id = nextId.current++
    setItems((list) => [...list.slice(-3), { id, tone, text }])
    setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4000)
  }, [dismiss])

  const api = useMemo<ToastApi>(() => ({ success: (t) => push('success', t), error: (t) => push('error', t) }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-[2rem] px-5 py-4 text-sm font-black shadow-xl ${
              t.tone === 'error' ? 'bg-flag text-white' : 'bg-ink text-white'
            }`}
          >
            {t.tone === 'error'
              ? <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              : <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-sun" aria-hidden />}
            <span className="flex-1">{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-white/15"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
