/**
 * Poll until the server (middleware / RSC) can validate the session from request cookies.
 * More reliable than `document.cookie` because Supabase SSR auth cookies are often httpOnly.
 */
export async function waitForServerSessionReady(options?: {
  maxAttempts?: number
  msBetween?: number
}): Promise<boolean> {
  if (typeof window === "undefined") return false

  const maxAttempts = options?.maxAttempts ?? 80
  const msBetween = options?.msBetween ?? 50

  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch("/api/auth/session-ready", {
        credentials: "include",
        cache: "no-store",
      })
      if (res.status === 204) return true
    } catch {
      /* transient network blip — retry */
    }
    await new Promise((r) => setTimeout(r, msBetween))
  }

  try {
    const res = await fetch("/api/auth/session-ready", {
      credentials: "include",
      cache: "no-store",
    })
    return res.status === 204
  } catch {
    return false
  }
}
