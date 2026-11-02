/** Per-attempt ceiling so a hung `/api/auth/session-ready` cannot trap sign-in forever. */
const SESSION_READY_FETCH_MS = 2_500

async function probeSessionReady(): Promise<boolean> {
  const res = await fetch("/api/auth/session-ready", {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(SESSION_READY_FETCH_MS),
  })
  return res.status === 204
}

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
      if (await probeSessionReady()) return true
    } catch {
      /* timeout / transient network blip — retry */
    }
    await new Promise((r) => setTimeout(r, msBetween))
  }

  try {
    return await probeSessionReady()
  } catch {
    return false
  }
}
