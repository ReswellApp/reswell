import { pathnameRequiresAuthSession } from '@/lib/auth/pathname-requires-auth-session'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Supabase sometimes falls back to Site URL with ?code= on the homepage. Forward to
  // `/auth/callback` so the server exchanges the PKCE code and can route new Google users
  // to `/auth/google-sign-up-success`.
  if (pathname !== "/auth/callback" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/callback"
    return NextResponse.redirect(url)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Skip Supabase auth when env vars are not configured (e.g. local viewing)
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  /** Legacy / bookmarked URLs — same hub as /dashboard/offers (see app/offers/page.tsx). */
  const isOffersShortcut = pathname === '/offers' || pathname.startsWith('/offers/')
  const requiresAuth = pathnameRequiresAuthSession(pathname)

  if (requiresAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    const redirectTarget = isOffersShortcut
      ? `/dashboard/offers${request.nextUrl.search}`
      : `${request.nextUrl.pathname}${request.nextUrl.search}`
    url.searchParams.set('redirect', redirectTarget)
    return NextResponse.redirect(url)
  }

  // Admin routes: same rule as app/admin/layout.tsx — staff only (not buyers/sellers).
  if (request.nextUrl.pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, is_employee')
      .eq('id', user.id)
      .single()

    const isStaff =
      profile?.is_admin === true || profile?.is_employee === true

    if (!isStaff) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
