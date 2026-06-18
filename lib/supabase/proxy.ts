import {
  clearSupabaseAuthCookies,
  isInvalidRefreshTokenError,
  isNonFatalGetUserError,
  isTransientAuthNetworkError,
} from '@/lib/auth/clear-supabase-auth-cookies'
import { hasSupabaseAuthCookies } from '@/lib/auth/has-supabase-auth-cookies'
import { pathnameRequiresAuthSession } from '@/lib/auth/pathname-requires-auth-session'
import { pathnameSkipsAuthSessionRefresh } from '@/lib/auth/pathname-skips-auth-session-refresh'
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

  // Session cookies are set on the response inside these route handlers. Calling
  // `getUser()` here fails with AuthSessionMissingError (no JWT yet) and used to
  // surface as a 500 before OAuth code exchange could run.
  if (
    pathname === "/auth/callback" ||
    pathname === "/auth/confirm" ||
    pathname === "/auth/recovery"
  ) {
    return NextResponse.next({ request })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Skip Supabase auth when env vars are not configured (e.g. local viewing)
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  const requiresAuth = pathnameRequiresAuthSession(pathname)
  const canSkipSessionRefresh =
    !requiresAuth &&
    pathnameSkipsAuthSessionRefresh(pathname) &&
    !hasSupabaseAuthCookies(request.cookies.getAll())

  if (canSkipSessionRefresh) {
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
  //
  // When the access token is expired, getUser() auto-refreshes using the
  // refresh-token cookie. If that token was already rotated/revoked, GoTrue
  // returns `refresh_token_not_found` and the call may reject. Treat it as a
  // logged-out user and purge the dead cookies so the browser stops replaying
  // the same failed refresh on every request.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] =
    null
  const getUserAttempts = 3
  for (let attempt = 0; attempt < getUserAttempts; attempt += 1) {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          clearSupabaseAuthCookies(request, supabaseResponse)
          break
        }
        if (isNonFatalGetUserError(error)) {
          if (
            isTransientAuthNetworkError(error) &&
            attempt < getUserAttempts - 1
          ) {
            await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
            continue
          }
          break
        }
        throw error
      }
      user = data.user
      break
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        clearSupabaseAuthCookies(request, supabaseResponse)
        break
      }
      if (isNonFatalGetUserError(error)) {
        if (
          isTransientAuthNetworkError(error) &&
          attempt < getUserAttempts - 1
        ) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
          continue
        }
        break
      }
      throw error
    }
  }

  /** Legacy / bookmarked URLs — same hub as /dashboard/offers (see app/offers/page.tsx). */
  const isOffersShortcut = pathname === '/offers' || pathname.startsWith('/offers/')

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
