// Joins the SQL files into supabase/all_in_one.sql so the whole setup can be run in one go
// in the Supabase SQL Editor. Run with `npm run sql:bundle` after editing any SQL file.
// 03_seed.sql (sample puroks) is left out on purpose.
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../supabase/', import.meta.url))
export const PARTS = ['01_schema.sql', '02_security.sql', '04_form_fields_extra.sql', '05_form_settings.sql', '06_custom_questions.sql']

export function bundle() {
  const header = `-- =====================================================================
-- KK Youth Profiling System  |  all_in_one.sql   (GENERATED, do not edit)
-- ${PARTS.join(', ')} in order, in one file.
-- Paste the whole file into Supabase Dashboard > SQL Editor and click Run.
-- Safe to re-run. Sample puroks (03_seed.sql) are not included.
-- Rebuild with: npm run sql:bundle
-- =====================================================================
`
  return header + PARTS.map((f) => `\n-- >>>>>>>>>>>>>>>>>>>> ${f} <<<<<<<<<<<<<<<<<<<<\n\n${fs.readFileSync(dir + f, 'utf8').trimEnd()}\n`).join('')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(dir + 'all_in_one.sql', bundle())
  console.log('wrote supabase/all_in_one.sql')
}
