import { parseBrowserSessionRoute } from '@/lib/auth/browser-session'
import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const parsed = parseBrowserSessionRoute(pathname)

  if (parsed) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = parsed.strippedPath
    return updateSession(request, {
      rewriteUrl,
      browserSessionId: parsed.sessionId,
      originalPathname: pathname,
      strippedPath: parsed.strippedPath,
    })
  }

  return updateSession(request, {
    originalPathname: pathname,
    strippedPath: pathname,
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
