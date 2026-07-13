import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest, NextResponse } from 'next/server'
import { resolveSeoRedirect } from '@/lib/seo/edge-redirects'
import {
  evaluateAdCatalogCrawlerAccess,
  isAdCatalogCrawler,
} from '@/lib/crawler/ad-catalog-crawler'
import {
  isPublicMarketplaceHtmlPath,
  PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL,
} from '@/lib/crawler/public-marketplace-paths'

function applyPublicMarketplaceCacheHints(response: NextResponse, pathname: string): NextResponse {
  if (!isPublicMarketplaceHtmlPath(pathname)) return response
  if (response.status >= 300 && response.status < 400) return response
  response.headers.set('CDN-Cache-Control', PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL)
  return response
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const catalogAccess = evaluateAdCatalogCrawlerAccess(request)
  if (!catalogAccess.allowed) {
    return new NextResponse(catalogAccess.message, {
      status: catalogAccess.status,
      headers: {
        'Retry-After': '60',
        'Cache-Control': 'no-store',
      },
    })
  }

  // Admin-managed 301/302 redirects short-circuit before any session work.
  const redirect = await resolveSeoRedirect(request)
  if (redirect) return redirect

  try {
    const response = await updateSession(request)

    if (isAdCatalogCrawler(request.headers.get('user-agent'))) {
      return applyPublicMarketplaceCacheHints(response, pathname)
    }

    return response
  } catch (error) {
    console.error('[middleware] proxy failed; passing through', {
      pathname,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.next({ request })
  }
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
