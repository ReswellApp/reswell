import { canonicalHostRedirectResponse } from '@/lib/middleware/canonical-host-redirect'
import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const canonicalRedirect = canonicalHostRedirectResponse(request)
  if (canonicalRedirect) {
    return canonicalRedirect
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - api/webhooks/* — Stripe/ShipEngine need the raw body; skip Supabase session work here
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|api/webhooks/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
