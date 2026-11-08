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
  "failed to load chunk",
  "failed to load css chunk",
  "unable to preload css",
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
]

const NEXT_STATIC_PATH = "/_next/static/"

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

/** True when a URL points at a hashed Next.js build asset. */
export function isNextStaticAssetUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    return new URL(url, "https://reswell.app").pathname.includes(NEXT_STATIC_PATH)
  } catch {
    return url.includes(NEXT_STATIC_PATH)
  }
}

type EventTargetLike = {
  tagName?: unknown
  src?: unknown
  href?: unknown
}

/**
 * Script / stylesheet / modulepreload failures for `/_next/static/*` fire as
 * `ErrorEvent`s whose `error` is often null (especially in in-app browsers).
 * Match the element so recovery still runs.
 */
export function isNextStaticAssetLoadFailure(event: Event): boolean {
  const target = event.target
  if (!target || typeof target !== "object") return false
  const el = target as EventTargetLike
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : ""
  if (tag === "SCRIPT" && typeof el.src === "string") return isNextStaticAssetUrl(el.src)
  if (tag === "LINK" && typeof el.href === "string") return isNextStaticAssetUrl(el.href)
  return false
}

type PostHogEventLike = {
  event?: string
  properties?: Record<string, unknown> | null
} | null | undefined

function collectExceptionText(properties: Record<string, unknown> | null | undefined): string {
  if (!properties) return ""
  const parts: string[] = []

  for (const key of ["$exception_type", "$exception_message"] as const) {
    const value = properties[key]
    if (typeof value === "string") parts.push(value)
  }

  const list = properties.$exception_list
  if (!Array.isArray(list)) return parts.join("\n")

  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    for (const key of ["type", "value", "$exception_type", "$exception_message"] as const) {
      const value = rec[key]
      if (typeof value === "string") parts.push(value)
    }
  }

  return parts.join("\n")
}

/** Drop `$exception` events that are stale-chunk failures, not application bugs. */
export function isPostHogChunkLoadError(event: PostHogEventLike): boolean {
  if (!event || event.event !== "$exception") return false
  return isChunkLoadError(collectExceptionText(event.properties))
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

  // `reload()` uses the spec "reload" cache mode so HTML revalidates. Assigning
  // href is a fallback for in-app browsers that treat reload as a no-op.
  try {
    window.location.reload()
  } catch {
    window.location.href = window.location.href
  }
  return true
}
