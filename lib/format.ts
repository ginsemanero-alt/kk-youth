export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = iso.length <= 10 ? new Date(iso + 'T00:00:00') : new Date(iso)
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function ageOn(birthdate: string, on: Date = new Date()): number {
  const b = new Date(birthdate + 'T00:00:00')
  let age = on.getFullYear() - b.getFullYear()
  const m = on.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--
  return age
}

export const toList = (s: string): string[] =>
  s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)

/** Escape a user-supplied text for a PostgREST ilike filter. */
export const likeSafe = (s: string) => s.replace(/[%_,()]/g, ' ').trim()
