import { pathnameRequiresAuthSession } from "@/lib/auth/pathname-requires-auth-session"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

type AppRouter = {
  push: (href: string) => void
  refresh: () => void
}

/**
 * After password (or other) client-side sign-in, the Supabase browser client can report
 * a user before HTTP cookie writes are visible to middleware. A soft `router.push` to
 * `/sell` (etc.) then 302s to login — feels like a logout. Full navigation guarantees
 * cookies go with the document request. OAuth already sets cookies on `/auth/callback`.
 */
export function navigateAfterClientAuth(redirectTo: string, router: AppRouter): void {
  const target = safeRedirectPath(redirectTo)
  const pathOnly = target.split("?")[0] ?? "/"

  if (pathnameRequiresAuthSession(pathOnly)) {
    window.location.assign(target)
    return
  }

  router.push(target)
  router.refresh()
}
