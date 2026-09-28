/**
 * Poll until the server (middleware / RSC) can validate the session from request cookies.
 * More reliable than `document.cookie` because Supabase SSR auth cookies are often httpOnly.
 *
 * Each attempt aborts if the probe hangs. A single fetch with no timeout used to leave
 * the login card on its spinner for as long as GoTrue stayed quiet.
 */

const DEFAULT_ATTEMPT_TIMEOUT_MS = 2500

export type ServerSessionProbe = "ready" | "anonymous" | "unknown"

export function serverSessionProbeFromStatus(status: number): ServerSessionProbe {
  if (status === 204) return "ready"
  if (status === 401) return "anonymous"
  return "unknown"
}

export async function probeServerSessionOnce(
  timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
): Promise<ServerSessionProbe> {
  if (typeof window === "undefined") return "unknown"

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch("/api/auth/session-ready", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
    return serverSessionProbeFromStatus(res.status)
  } catch {
    return "unknown"
  } finally {
    window.clearTimeout(timer)
  }
}

export async function waitForServerSessionReady(options?: {
  maxAttempts?: number
  msBetween?: number
  attemptTimeoutMs?: number
}): Promise<boolean> {
  if (typeof window === "undefined") return false

  const maxAttempts = options?.maxAttempts ?? 80
  const msBetween = options?.msBetween ?? 50
  const attemptTimeoutMs = options?.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS
  let consecutiveHangs = 0

  for (let i = 0; i < maxAttempts; i += 1) {
    const started = Date.now()
    const probe = await probeServerSessionOnce(attemptTimeoutMs)
    if (probe === "ready") return true
    // A hung probe (abort) is not cookie lag. Stop after a few so sign-in cannot spin.
    if (Date.now() - started >= attemptTimeoutMs - 25) {
      consecutiveHangs += 1
      if (consecutiveHangs >= 3) return false
    } else {
      consecutiveHangs = 0
    }
    await new Promise((r) => setTimeout(r, msBetween))
  }

  const probe = await probeServerSessionOnce(attemptTimeoutMs)
  return probe === "ready"
}
