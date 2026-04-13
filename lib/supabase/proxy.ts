import {
  getBrowserSessionIdFromHeaders,
  supabaseAuthStorageKeyFromSessionId,
} from '@/lib/auth/browser-session'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export type SessionMiddlewareContext = {
  /** When set, middleware rewrites the URL to this pathname (internal routing). */
  rewriteUrl?: URL
  /** Supabase auth cookie storage suffix (from `/w/{uuid}/…`). */
  browserSessionId?: string | null
  /** Visible path before rewrite (for login ?redirect=). */
  originalPathname?: string
  /** Path after stripping `/w/{uuid}` (for route protection checks). */
  strippedPath?: string
}

export async function updateSession(
  request: NextRequest,
  ctx?: SessionMiddlewareContext,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  const cookieStorageName = supabaseAuthStorageKeyFromSessionId(
    ctx?.browserSessionId ?? undefined,
  )

  const buildBaseResponse = () => {
    if (ctx?.rewriteUrl) {
      const requestHeaders = new Headers(request.headers)
      if (ctx.browserSessionId) {
        requestHeaders.set('x-reswell-browser-session', ctx.browserSessionId)
      }
      return NextResponse.rewrite(ctx.rewriteUrl, {
        request: { headers: requestHeaders },
      })
    }
    const requestHeaders = new Headers(request.headers)
    const fromRequest = getBrowserSessionIdFromHeaders((name) => request.headers.get(name))
    const sid = ctx?.browserSessionId ?? fromRequest
    if (sid) {
      requestHeaders.set('x-reswell-browser-session', sid)
    }
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  let supabaseResponse = buildBaseResponse()

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...(cookieStorageName ? { cookieOptions: { name: cookieStorageName } } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = buildBaseResponse()
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname =
    ctx?.strippedPath ?? request.nextUrl.pathname
  const pathnameForRedirects = ctx?.originalPathname ?? request.nextUrl.pathname

  const isPublicSellOgAsset =
    pathname === '/sell/opengraph-image' || pathname === '/sell/twitter-image'
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/messages') ||
    pathname.startsWith('/admin') ||
    (pathname.startsWith('/sell/') && !isPublicSellOgAsset)

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', pathnameForRedirects)
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
