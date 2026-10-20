'use client'
import { useState } from 'react'
import { FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { exportPdf, exportXlsx, type Column, type Row } from '@/lib/export'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { Alert, btnGhost } from '@/components/ui'

/** Exports rows to Excel/PDF. The export is written to the audit log first; if that fails, nothing is exported. */
export default function ExportButtons({ rows, columns, title, subtitle = '', filename, source, filters, printable = false }: {
  rows: Row[]
  columns: Column[]
  title: string
  subtitle?: string
  filename: string
  source: string
  filters?: Record<string, unknown>
  /** Adds a Print button (opens the browser print dialog for the print layout of the page). */
  printable?: boolean
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | 'print' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: 'xlsx' | 'pdf' | 'print') => {
    setError(null)
    setBusy(kind)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.rpc('log_event', {
        p_action: 'export', p_table: source, p_detail: { format: kind, rows: rows.length, filters: filters ?? {} },
      })
      if (err) throw err
      if (kind === 'xlsx') await exportXlsx(rows, filename, title)
      else if (kind === 'pdf') await exportPdf(title, subtitle, columns, rows, filename)
      else window.print()
    } catch (e) {
      const m = friendlyError(e as { message?: string })
      setError(m)
      toast.error(m)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button type="button" disabled={rows.length === 0 || busy !== null} onClick={() => run('xlsx')} className={btnGhost}>
          {busy === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
        </button>
        <button type="button" disabled={rows.length === 0 || busy !== null} onClick={() => run('pdf')} className={btnGhost}>
          {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
        </button>
        {printable && (
          <button type="button" disabled={rows.length === 0 || busy !== null} onClick={() => run('print')} className={btnGhost}>
            {busy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print
          </button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
    </div>
  )
}
