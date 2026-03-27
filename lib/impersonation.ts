export const IMPERSONATION_COOKIE = "admin_impersonating"

export interface ImpersonationData {
  userId: string
  displayName: string
  email: string | null
}

export function getImpersonation(): ImpersonationData | null {
  if (typeof document === "undefined") return null
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${IMPERSONATION_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=")
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(raw)) as ImpersonationData
  } catch {
    return null
  }
}

export function clearImpersonationCookie() {
  document.cookie = `${IMPERSONATION_COOKIE}=; path=/; max-age=0`
}
