// Route-level RBAC check (run with `npm run test:routes`). Static analysis of the source:
//  1. every page under app/(app) calls requireRole() with exactly the roles in POLICY below,
//     and passes its own route pattern as the audit path;
//  2. the sidebar menu (components/AppShell.tsx) shows each link only to the roles its page allows;
//  3. no client component imports the service-role client, and that client is marked server-only.
// The database rules are tested separately in supabase/tests/rls.test.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const A = 'admin', E = 'encoder', V = 'viewer'

// Target permission policy: route pattern -> roles allowed to open it.
const POLICY = {
  '/dashboard': [A, E, V],
  '/statistics': [A, E, V],
  '/reports': [A, E, V],
  '/account': [A, E, V],
  '/youth': [A, E],
  '/youth/new': [A, E],
  '/youth/[id]': [A, E],
  '/youth/[id]/edit': [A, E],
  '/osy': [A, E],
  '/registrations': [A, E],
  '/activities': [A, E],
  '/activities/new': [A, E],
  '/activities/[id]': [A, E],
  '/activities/[id]/edit': [A, E],
  '/activities/unreached': [A, E],
  '/import': [A, E],
  '/puroks': [A],
  '/archive': [A],
  '/admin/users': [A],
  '/admin/audit': [A],
  '/admin/form-settings': [A],
}

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name) } else { fail++; console.log('  FAIL', name, extra) } }
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]))
const rolesOf = (src) => [...src.matchAll(/'(admin|encoder|viewer)'/g)].map((m) => m[1]).sort().join(',')

// 1. Page guards
const appDir = path.join(root, 'app', '(app)')
const pages = walk(appDir).filter((f) => f.endsWith(`${path.sep}page.tsx`))
const seen = new Set()
for (const file of pages) {
  const route = '/' + path.relative(appDir, path.dirname(file)).split(path.sep).join('/')
  seen.add(route)
  const src = fs.readFileSync(file, 'utf8')
  const m = src.match(/requireRole\(\[([^\]]*)\]\s*,\s*'([^']+)'\)/)
  ok(`${route}: has a server-side requireRole guard`, Boolean(m))
  if (!m) continue
  ok(`${route}: audit path matches the route`, m[2] === route, `got ${m[2]}`)
  const expected = POLICY[route]
  ok(`${route}: is in the permission policy`, Boolean(expected))
  if (expected) ok(`${route}: allows exactly ${expected.join(', ')}`, rolesOf(m[1]) === [...expected].sort().join(','), `got ${rolesOf(m[1])}`)
}
for (const route of Object.keys(POLICY)) ok(`${route}: page exists`, seen.has(route))

// Viewer must not reach any individual-record page.
for (const r of ['/youth', '/youth/[id]', '/osy', '/registrations', '/activities/[id]', '/activities/unreached', '/import', '/archive', '/admin/users', '/admin/audit']) {
  ok(`viewer cannot open ${r}`, !POLICY[r].includes(V))
}

// 2. Menu matches the guards
const shell = fs.readFileSync(path.join(root, 'components', 'AppShell.tsx'), 'utf8')
const ROLESETS = { ALL: [A, E, V], STAFF: [A, E] }
for (const m of shell.matchAll(/\{ href: '([^']+)'[^}]*roles: (ALL|STAFF|\[[^\]]*\])/g)) {
  const [, href, r] = m
  const menuRoles = (ROLESETS[r] ?? rolesOf(r).split(',')).slice().sort().join(',')
  const pageRoles = POLICY[href]?.slice().sort().join(',')
  ok(`menu ${href}: shown to the same roles as its page guard`, menuRoles === pageRoles, `menu ${menuRoles} vs page ${pageRoles}`)
}

// 3. Service-role key stays on the server
const adminClient = fs.readFileSync(path.join(root, 'lib', 'supabase', 'admin.ts'), 'utf8')
ok('service-role client imports server-only', adminClient.includes("import 'server-only'"))
const sources = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components')), ...walk(path.join(root, 'lib'))].filter((f) => /\.(tsx?|mjs)$/.test(f))
for (const f of sources) {
  const src = fs.readFileSync(f, 'utf8')
  if (/^\s*['"]use client['"]/.test(src) && src.includes('@/lib/supabase/admin')) ok(`${path.relative(root, f)}: client file does not import the service-role client`, false)
  if (src.includes('NEXT_PUBLIC_SUPABASE_SERVICE')) ok(`${path.relative(root, f)}: service key is not exposed as NEXT_PUBLIC_`, false)
}
ok('no client component imports the service-role client', true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
