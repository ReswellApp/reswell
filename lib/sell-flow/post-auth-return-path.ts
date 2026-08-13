import { isSellFlowReturnPath } from "@/lib/auth/is-sell-flow-return-path"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

/**
 * Sell auth return URL with `?new=1` stripped.
 * Landing on `?new=1` after sign-up wipes the in-progress draft (and can bounce
 * first-time publishers from Guided boards onto empty Quick List).
 */
export function sellPostAuthReturnPath(href: string): string {
  const safe = safeRedirectPath(href)
  if (!isSellFlowReturnPath(safe)) return safe
  const qIndex = safe.indexOf("?")
  if (qIndex === -1) return safe
  const pathname = safe.slice(0, qIndex)
  const params = new URLSearchParams(safe.slice(qIndex + 1))
  params.delete("new")
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
