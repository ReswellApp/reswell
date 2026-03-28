export const IMPERSONATION_COOKIE = "admin_impersonating"
const STORAGE_KEY = "admin_impersonating"

export interface ImpersonationData {
  userId: string
  displayName: string
  email: string | null
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

/** Clear impersonation from both localStorage and the cookie. */
export function clearImpersonation() {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
  document.cookie = `${IMPERSONATION_COOKIE}=; path=/; max-age=0`
}
