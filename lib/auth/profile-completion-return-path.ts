import { COMPLETE_PROFILE_PATH } from "@/lib/auth/profile-completion"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

/** Where to send the user after they finish username / profile setup. */
export function resolveProfileCompletionReturnPath(
  pathname: string | null,
  searchParams: Pick<URLSearchParams, "get" | "toString">,
): string {
  if (pathname === COMPLETE_PROFILE_PATH) {
    return safeRedirectPath(searchParams.get("next"))
  }
  if (!pathname || pathname.startsWith("/auth/")) {
    return "/"
  }
  const query = searchParams.toString()
  return safeRedirectPath(`${pathname}${query ? `?${query}` : ""}`)
}
