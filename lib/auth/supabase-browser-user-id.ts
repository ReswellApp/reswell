const AUTH_TOKEN_NAME = /^sb-[A-Za-z0-9]+-auth-token(?:\.(\d+))?$/
const BASE64_PREFIX = "base64-"

type SessionRecord = {
  access_token?: unknown
  expires_at?: unknown
  user?: { id?: unknown } | null
}

/**
 * User id from a Supabase SSR auth cookie, without a network round trip.
 * Used only to decide which listing chrome to paint in this browser.
 * Server actions still authorize every mutation.
 */
export function readSupabaseUserIdFromCookieHeader(
  cookieHeader: string,
  nowMs = Date.now(),
): string | null {
  const raw = combineAuthTokenCookie(parseCookieHeader(cookieHeader))
  if (!raw) return null
  return userIdFromSupabaseSession(parseSupabaseSessionCookie(raw), nowMs)
}

/** `document.cookie` equivalent. Returns null during SSR. */
export function readSupabaseBrowserUserId(nowMs = Date.now()): string | null {
  if (typeof document === "undefined") return null
  return readSupabaseUserIdFromCookieHeader(document.cookie, nowMs)
}

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const name = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1)
    cookies.set(name, value)
  }
  return cookies
}

function combineAuthTokenCookie(cookies: Map<string, string>): string | null {
  let baseName: string | null = null
  const chunks = new Map<number, string>()

  for (const [name, value] of cookies) {
    const match = AUTH_TOKEN_NAME.exec(name)
    if (!match) continue
    baseName = name.replace(/\.\d+$/, "")
    if (match[1] === undefined) {
      if (value) return safeDecode(value)
      continue
    }
    chunks.set(Number(match[1]), value)
  }

  if (!baseName || chunks.size === 0) return null

  const ordered: string[] = []
  for (let i = 0; ; i++) {
    const chunk = chunks.get(i)
    if (chunk === undefined) break
    ordered.push(chunk)
  }
  if (ordered.length === 0) return null
  return safeDecode(ordered.join(""))
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseSupabaseSessionCookie(raw: string): unknown {
  const candidates = [raw]
  if (!raw.startsWith(BASE64_PREFIX)) {
    try {
      candidates.unshift(decodeURIComponent(raw))
    } catch {
      // already decoded
    }
  }

  for (const candidate of candidates) {
    try {
      if (candidate.startsWith(BASE64_PREFIX)) {
        return JSON.parse(decodeBase64Url(candidate.slice(BASE64_PREFIX.length)))
      }
      return JSON.parse(candidate)
    } catch {
      // try the next shape
    }
  }
  return null
}

function userIdFromSupabaseSession(value: unknown, nowMs: number): string | null {
  if (!value || typeof value !== "object") return null
  const session = value as SessionRecord
  if (typeof session.expires_at === "number" && session.expires_at * 1000 <= nowMs) {
    return null
  }
  const userId = session.user?.id
  if (typeof userId === "string" && userId.length > 0) return userId
  if (typeof session.access_token === "string") {
    return userIdFromAccessToken(session.access_token, nowMs)
  }
  return null
}

function userIdFromAccessToken(token: string, nowMs: number): string | null {
  const payload = token.split(".")[1]
  if (!payload) return null
  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { sub?: unknown; exp?: unknown }
    if (typeof parsed.exp === "number" && parsed.exp * 1000 <= nowMs) return null
    return typeof parsed.sub === "string" && parsed.sub.length > 0 ? parsed.sub : null
  } catch {
    return null
  }
}

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/")
  const padLength = (4 - (padded.length % 4)) % 4
  const base64 = padded + "=".repeat(padLength)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
