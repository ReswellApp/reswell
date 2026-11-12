import { ACCOUNT_BANNED_ERROR } from '@/lib/messages/account-ban-errors'
import { attachDeviceCookie, isSignupPath } from '@/lib/messages/access-signals'
import { isNextRequestAccessBanned } from '@/lib/services/requestAccessBan'
import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest, NextResponse } from 'next/server'
import { resolveSeoRedirect } from '@/lib/seo/edge-redirects'
import {
  evaluateAdCatalogCrawlerAccess,
} from '@/lib/crawler/ad-catalog-crawler'
import {
  BROWSER_HTML_CACHE_CONTROL,
  isCacheablePublicMarketplaceRequest,
  publicMarketplaceCdnCacheControl,
  shouldAttachDeviceCookieOnDocument,
} from '@/lib/crawler/public-marketplace-paths'
import {
  listingIsAnonymousPublicHtml,
  listingParamFromPublicPath,
} from '@/lib/crawler/listing-html-cdn'
import { isServerActionRequest } from '@/lib/utils/is-server-action-request'

async function applyPublicMarketplaceCacheHints(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  if (response.status >= 300 && response.status < 400) return response
  if (
    !isCacheablePublicMarketplaceRequest(
      request.method,
      isServerActionRequest(request),
    )
  ) {
    return response
  }
  const pathname = request.nextUrl.pathname
  const hasSetCookie = response.headers.has('set-cookie')
  let isAnonymousPublicListingHtml = false
  if (!hasSetCookie) {
    const listingParam = listingParamFromPublicPath(pathname)
    if (listingParam) {
      isAnonymousPublicListingHtml = await listingIsAnonymousPublicHtml(listingParam)
    }
  }
  const cacheControl = publicMarketplaceCdnCacheControl(pathname, hasSetCookie, {
    isAnonymousPublicListingHtml,
  })
  if (!cacheControl) return response
  response.headers.set('CDN-Cache-Control', cacheControl)
  // CDN-Cache-Control wins at the edge. Cache-Control is what the browser keeps,
  // and it must not hold HTML across deploys (stale HTML → ChunkLoadError).
  response.headers.set('Cache-Control', BROWSER_HTML_CACHE_CONTROL)
  return response
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isServerAction = isServerActionRequest(request)

  const catalogAccess = evaluateAdCatalogCrawlerAccess(request)
  if (!catalogAccess.allowed && !isServerAction) {
    return new NextResponse(catalogAccess.message, {
      status: catalogAccess.status,
      headers: {
        'Retry-After': '60',
        'Cache-Control': 'no-store',
      },
    })
  }

  // HTML 302s break Server Actions (client requires text/x-component).
  if (!isServerAction) {
    const redirect = await resolveSeoRedirect(request)
    if (redirect) return redirect
  }

  try {
    if (
      !isServerAction &&
      isSignupPath(pathname) &&
      (await isNextRequestAccessBanned(request))
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('error', ACCOUNT_BANNED_ERROR)
      return attachDeviceCookie(request, NextResponse.redirect(url))
    }

    const response = await updateSession(request)
    const withDevice = shouldAttachDeviceCookieOnDocument(pathname)
      ? attachDeviceCookie(request, response)
      : response

    return await applyPublicMarketplaceCacheHints(request, withDevice)
  } catch (error) {
    console.error('[middleware] proxy failed; passing through', {
      pathname,
      message: error instanceof Error ? error.message : String(error),
    })
    const passthrough = NextResponse.next({ request })
    return shouldAttachDeviceCookieOnDocument(pathname)
      ? attachDeviceCookie(request, passthrough)
      : passthrough
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp, video
     * - media/* — public listing/blog bytes; skip session + device cookie so the CDN can store them
     * - api/webhooks/* — Stripe/ShipEngine need the raw body; skip Supabase session work here
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|media/|api/webhooks/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|mov|webm|m4v)$).*)',
  ],
}
