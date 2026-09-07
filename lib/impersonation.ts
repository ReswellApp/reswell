export const IMPERSONATION_COOKIE = "admin_impersonating"
const STORAGE_KEY = "admin_impersonating"
export const IMPERSONATION_CHANGED_EVENT = "reswell:impersonation-changed"
export const IMPERSONATION_COOKIE_MAX_AGE_SEC = 60 * 60 * 4

export interface ImpersonationData {
  userId: string
  displayName: string
  email: string | null
}

export function impersonationCookieOptions(
  maxAgeSec: number = IMPERSONATION_COOKIE_MAX_AGE_SEC,
) {
  return {
    path: "/",
    maxAge: maxAgeSec,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  }
}

export function serializeImpersonationCookie(data: ImpersonationData): string {
  return JSON.stringify({
    userId: data.userId,
    displayName: data.displayName.trim() || "User",
    email: data.email,
  })
}

function notifyImpersonationChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(IMPERSONATION_CHANGED_EVENT))
}

/** Parse the impersonation cookie value on the server. Handles both encoded and plain JSON. */
export function parseImpersonationCookie(raw: string): ImpersonationData | null {
  const tryParse = (s: string): ImpersonationData | null => {
    try {
      const v = JSON.parse(s) as Partial<ImpersonationData>
      if (!v?.userId || typeof v.userId !== "string") return null
      return {
        userId: v.userId,
        displayName: typeof v.displayName === "string" && v.displayName.trim() ? v.displayName.trim() : "User",
        email: typeof v.email === "string" ? v.email : null,
      }
    } catch {
      return null
    }
  }
  const first = tryParse(raw)
  if (first) return first
  try {
    return tryParse(decodeURIComponent(raw))
  } catch {
    return null
  }
}

/** Store impersonation data client-side (localStorage). Call after the API sets the cookie. */
export function setImpersonation(data: ImpersonationData) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  notifyImpersonationChanged()
}

/** Read impersonation data from localStorage (client-side only). */
export function getImpersonation(): ImpersonationData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ImpersonationData
  } catch {
    return null
  }
}

/**
 * Keep localStorage in sync when the impersonation cookie is readable.
 *
 * Do **not** wipe localStorage when `document.cookie` omits the cookie — Next.js
 * may set it httpOnly, in which case fetch still sends it but JS cannot see it.
 * Wiping here dropped the admin “edit as seller” target and Save then aborted.
 */
export function clearImpersonationStorageIfCookieMissing() {
  if (typeof window === "undefined") return
  const raw = readCookieValue(IMPERSONATION_COOKIE)
  if (!raw) return
  const parsed = parseImpersonationCookie(raw)
  if (!parsed) return
  const stored = getImpersonation()
  // A stale document.cookie (previous seller) must not overwrite the target
  // written immediately after POST /api/admin/impersonate.
  if (stored && stored.userId !== parsed.userId) return
  setImpersonation(parsed)
}

/** Clear impersonation from both localStorage and the cookie. */
export function clearImpersonation() {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
  document.cookie = `${IMPERSONATION_COOKIE}=; path=/; max-age=0`
  notifyImpersonationChanged()
}

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null
  const prefix = `${name}=`
  for (const part of document.cookie.split(";")) {
    const p = part.trim()
    if (p.startsWith(prefix)) {
      return p.slice(prefix.length) || null
    }
  }
  return null
}

/**
 * Current impersonation target from the admin cookie, falling back to localStorage
 * when the cookie is httpOnly (still sent on `credentials: "include"` fetches).
 * Admin APIs still validate the HTTP cookie server-side.
 */
export function getActiveImpersonationClient(): ImpersonationData | null {
  if (typeof window === "undefined") return null
  const stored = getImpersonation()
  const raw = readCookieValue(IMPERSONATION_COOKIE)
  const fromCookie = raw ? parseImpersonationCookie(raw) : null
  if (stored && fromCookie && stored.userId !== fromCookie.userId) {
    // localStorage is written in the same tick as a successful impersonate POST.
    // document.cookie can still show the previous seller during client navigation.
    return stored
  }
  return fromCookie ?? stored
}
