import { hasSupabaseAuthCookies } from "@/lib/auth/has-supabase-auth-cookies"

function readDocumentAuthCookies(): { name: string }[] {
  if (typeof document === "undefined") return []
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ name: part.split("=")[0] ?? "" }))
    .filter(({ name }) => name.length > 0)
}

/** True when Supabase SSR auth cookies are visible on `document.cookie`. */
export function documentHasSupabaseAuthCookies(): boolean {
  return hasSupabaseAuthCookies(readDocumentAuthCookies())
}

/**
 * After client-side sign-in, the Supabase browser client can report a session before
 * HTTP-only auth cookies are readable on the document. Middleware then 302s back to login,
 * which can loop on mobile Safari and surface as "page load failed".
 */
export async function waitForAuthCookiesOnDocument(options?: {
  msBetween?: number
  maxAttempts?: number
}): Promise<boolean> {
  const msBetween = options?.msBetween ?? 50
  const maxAttempts = options?.maxAttempts ?? 40

  for (let i = 0; i < maxAttempts; i += 1) {
    if (documentHasSupabaseAuthCookies()) return true
    await new Promise((r) => setTimeout(r, msBetween))
  }

  return documentHasSupabaseAuthCookies()
}
