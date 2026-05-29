import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'
import { resolveSeoRedirect } from '@/lib/seo/edge-redirects'

export async function proxy(request: NextRequest) {
  // Admin-managed 301/302 redirects short-circuit before any session work.
  const redirect = await resolveSeoRedirect(request)
  if (redirect) return redirect

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
