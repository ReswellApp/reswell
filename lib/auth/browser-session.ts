/** Same-origin multi-tab sessions: isolate Supabase cookie keys per URL prefix `/w/{uuid}/…`. */

/** UUID v4 (Supabase session ids are not used here; we only need stable segment names.) */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const BROWSER_SESSION_URL_PREFIX = '/w' as const

export function parseBrowserSessionRoute(pathname: string): {
  sessionId: string
  strippedPath: string
} | null {
  if (!pathname.startsWith(`${BROWSER_SESSION_URL_PREFIX}/`)) return null
  const after = pathname.slice(BROWSER_SESSION_URL_PREFIX.length + 1)
  const slash = after.indexOf('/')
  const segment = slash === -1 ? after : after.slice(0, slash)
  if (!UUID_V4_RE.test(segment)) return null
  const rest = slash === -1 ? '' : after.slice(slash)
  const strippedPath = rest ? (rest.startsWith('/') ? rest : `/${rest}`) : '/'
  return { sessionId: segment, strippedPath }
}

/**
 * Supabase default storage key is `sb-{projectRef}-auth-token` (projectRef = hostname segment).
 * We suffix the session id so multiple sessions can coexist in one cookie jar.
 */
export function supabaseAuthStorageKeyFromSessionId(
  sessionId: string | null | undefined,
): string | undefined {
  if (!sessionId) return undefined
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return undefined
  const ref = new URL(url).hostname.split('.')[0]
  return `sb-${ref}-auth-token-${sessionId}`
}

/** Resolve session id from incoming request (RSC, route handlers, middleware). */
export function getBrowserSessionIdFromHeaders(getHeader: (name: string) => string | null): string | null {
  const direct = getHeader('x-reswell-browser-session')
  if (direct) return direct
  const fromMw = getHeader('x-middleware-request-x-reswell-browser-session')
  if (fromMw) return fromMw
  return null
}

export function prefixedPathForBrowserSession(path: string, sessionId: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${BROWSER_SESSION_URL_PREFIX}/${sessionId}${p}`
}

/** Preserve `/w/{id}` when linking inside an isolated session tab. */
export function withBrowserSessionIfPresent(href: string, currentPathname: string): string {
  const sid = parseBrowserSessionRoute(currentPathname)?.sessionId
  if (!sid) return href
  const target = href.startsWith('/') ? href : `/${href}`
  if (target.startsWith(`${BROWSER_SESSION_URL_PREFIX}/`)) return target
  return prefixedPathForBrowserSession(target, sid)
}

/** Open a fresh isolated session (new tab/window) with its own auth cookies. */
export function newBrowserSessionLoginPath(): string {
  const id = crypto.randomUUID()
  const afterLogin = `${BROWSER_SESSION_URL_PREFIX}/${id}/dashboard`
  return `${BROWSER_SESSION_URL_PREFIX}/${id}/auth/login?redirect=${encodeURIComponent(afterLogin)}`
}

export function browserSessionIdFromSafePath(nextPath: string): string | null {
  try {
    const path = new URL(nextPath, 'http://local.invalid').pathname
    return parseBrowserSessionRoute(path)?.sessionId ?? null
  } catch {
    return null
  }
}
