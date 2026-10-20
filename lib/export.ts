// SheetJS and jsPDF are heavy, so they are loaded on demand (dynamic import) and kept out of the main bundle.
const loadXlsx = () => import('xlsx')

export type Row = Record<string, string | number | null>
export interface Column { header: string; key: string }

const stamp = () => new Date().toISOString().slice(0, 10)

export async function exportXlsx(rows: Row[], filename: string, sheet = 'Data') {
  const XLSX = await loadXlsx()
  const ws = XLSX.utils.json_to_sheet(rows)
  const keys = Object.keys(rows[0] ?? {})
  ws['!cols'] = keys.map((k) => ({ wch: Math.min(40, Math.max(k.length, ...rows.slice(0, 200).map((r) => String(r[k] ?? '').length)) + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31))
  XLSX.writeFile(wb, `${filename}-${stamp()}.xlsx`)
}

export async function exportPdf(title: string, subtitle: string, columns: Column[], rows: Row[], filename: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: columns.length > 7 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, 40, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(subtitle, 40, 60)
  autoTable(doc, {
    startY: 74,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(r[c.key] ?? ''))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [10, 18, 48] },
    alternateRowStyles: { fillColor: [243, 245, 251] },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text('Confidential. Contains personal data protected by RA 10173.', 40, h - 20)
    },
  })
  doc.save(`${filename}-${stamp()}.pdf`)
}

/** Download an .xlsx made of several sheets (used for the import template and error report). */
export async function exportWorkbook(sheets: { name: string; rows: Row[] | string[][] }[], filename: string) {
  const XLSX = await loadXlsx()
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = Array.isArray(s.rows[0]) ? XLSX.utils.aoa_to_sheet(s.rows as string[][]) : XLSX.utils.json_to_sheet(s.rows as Row[])
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename)
}

/** Read the first sheet of an .xlsx/.xls/.csv file as rows of plain objects (dates as yyyy-mm-dd text). */
export async function readFirstSheet(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' })
}
