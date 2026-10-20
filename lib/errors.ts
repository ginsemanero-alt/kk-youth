interface ErrLike { message?: string; code?: string; details?: string | null }

/** Turn a Supabase/Postgres error into a sentence a non-technical encoder can act on. */
export function friendlyError(err: ErrLike | null | undefined): string {
  if (!err) return 'Something went wrong. Please try again.'
  const m = err.message ?? ''
  if (err.code === '23505' || m.includes('youth_no_duplicates') || m.startsWith('Duplicate'))
    return m.startsWith('Duplicate') ? m : 'A youth with the same name and birthdate already exists.'
  if (m.includes('between 15 and 30') || m.includes('15 to 30')) return 'Only youth aged 15 to 30 can be registered.'
  if (m.includes('guardian')) return 'Parent or guardian consent is required for youth below 18.'
  if (err.code === '42501' || m.includes('row-level security') || m.includes('Not allowed') || m.includes('Only an Admin'))
    return 'You do not have permission to do that.'
  if (m.includes('still has youth')) return 'This purok still has youth records. Move them to another purok first.'
  if (m.includes('Invalid login')) return 'Wrong email or password.'
  if (m.includes('Failed to fetch') || m.includes('NetworkError')) return 'Cannot reach the server. Check your internet connection.'
  if (m.includes('no longer pending')) return 'This registration was already reviewed.'
  return m || 'Something went wrong. Please try again.'
}
