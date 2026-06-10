/**
 * After a deploy, the browser may hold a stale document that references JS/CSS chunk
 * hashes that no longer exist on the CDN. Requesting them throws a `ChunkLoadError`
 * (dynamic import / route transition), which—without an error boundary—drops the user
 * onto Next.js's full-page fatal screen. This is most common on mobile, where tabs are
 * long-lived and assets are cached aggressively.
 *
 * Use {@link isChunkLoadError} in error boundaries to detect this case, then
 * {@link recoverFromChunkLoadError} to force a single fresh reload.
 */

const CHUNK_ERROR_PATTERNS = [
  "chunkloaderror",
  "loading chunk",
  "loading css chunk",
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
]

/** True when `error` looks like a stale/missing build asset rather than a real app bug. */
export function isChunkLoadError(error: unknown, depth = 0): boolean {
  if (error == null || depth > 4) return false

  if (error instanceof Error) {
    if (error.name === "ChunkLoadError") return true
    if (messageLooksLikeChunkError(error.message)) return true
    if ("cause" in error && isChunkLoadError(error.cause, depth + 1)) return true
    return false
  }

  if (typeof error === "object") {
    const name = (error as { name?: unknown }).name
    if (name === "ChunkLoadError") return true
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && messageLooksLikeChunkError(message)) return true
    if ("cause" in error && isChunkLoadError((error as { cause?: unknown }).cause, depth + 1)) {
      return true
    }
    return false
  }

  if (typeof error === "string") return messageLooksLikeChunkError(error)

  return false
}

function messageLooksLikeChunkError(value: string): boolean {
  const message = value.toLowerCase()
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}

/** sessionStorage key guarding against an infinite reload loop. */
const RELOAD_GUARD_KEY = "rw_chunk_reload_at"
/** Within this window a second chunk failure won't auto-reload again (avoids loops). */
const RELOAD_GUARD_WINDOW_MS = 10_000

/**
 * Force one fresh full reload to pull the latest assets. Returns `true` when a reload was
 * triggered, `false` when we recently reloaded already (so the boundary should render its
 * fallback UI instead of looping).
 */
export function recoverFromChunkLoadError(): boolean {
  if (typeof window === "undefined") return false

  let lastReloadAt = 0
  try {
    lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) ?? "0")
  } catch {
    /* sessionStorage unavailable (private mode / blocked): fall through and attempt reload */
  }

  if (Number.isFinite(lastReloadAt) && Date.now() - lastReloadAt < RELOAD_GUARD_WINDOW_MS) {
    return false
  }

  try {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    /* ignore: still attempt the reload */
  }

  window.location.reload()
  return true
}
