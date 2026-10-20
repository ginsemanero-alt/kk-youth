import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from '@/lib/env'

// Public pages. Everything else requires a signed-in user (roles are enforced again by RLS and by each page).
const PUBLIC = ['/', '/login', '/register', '/privacy']

export async function proxy(request: NextRequest) {
  if (!isConfigured) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // getUser() validates the token with Supabase Auth (getSession() alone is not trustworthy on the server).
  const { data } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isPublic = PUBLIC.includes(path) || path.startsWith('/auth/')

  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }
  if (data.user && path === '/login') {
    // A deactivated account is sent here with ?error=inactive. Sign it out instead of bouncing it back to
    // /dashboard, otherwise /dashboard and /login redirect to each other forever.
    if (request.nextUrl.searchParams.get('error') === 'inactive') {
      await supabase.auth.signOut()
      return response
    }
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
