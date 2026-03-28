export const IMPERSONATION_COOKIE = "admin_impersonating"
const STORAGE_KEY = "admin_impersonating"

/** Parse the impersonation cookie value on the server. Handles both encoded and plain JSON. */
export function parseImpersonationCookie(raw: string): { userId: string } | null {
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(decodeURIComponent(raw))
    } catch {
      return null
    }
  }
}

export interface ImpersonationData {
  userId: string
  displayName: string
  email: string | null
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
