import { clientAuthRequiresHardNavigation } from "@/lib/auth/client-auth-requires-hard-navigation"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { waitForAuthCookiesOnDocument } from "@/lib/auth/wait-for-auth-cookies-on-document"
import { waitForServerSessionReady } from "@/lib/auth/wait-for-server-session-ready"

type AppRouter = {
  push: (href: string) => void
  refresh: () => void
}

/**
 * After password (or other) client-side sign-in, the Supabase browser client can report
 * a user before HTTP cookie writes are visible to middleware. A soft `router.push` to
 * `/sell` (etc.) then 302s to login — feels like a logout. Full navigation guarantees
 * cookies go with the document request. OAuth already sets cookies on `/auth/callback`.
 *
 * Shopify claim/connect are public (guests see sign-in) but must hard-navigate after
 * login — soft push remounts the spinner forever when RSC still sees no session.
 */
export async function navigateAfterClientAuth(
  redirectTo: string,
  router: AppRouter,
): Promise<void> {
  const target = safeRedirectPath(redirectTo)
  const pathOnly = target.split("?")[0] ?? "/"
  const needsHardNavigation = clientAuthRequiresHardNavigation(pathOnly)

  const sessionWaitOptions = needsHardNavigation
    ? { maxAttempts: 100, msBetween: 50 }
    : { maxAttempts: 60, msBetween: 50 }

  const serverReady = await waitForServerSessionReady(sessionWaitOptions)
  if (!serverReady) {
    await waitForAuthCookiesOnDocument({
      maxAttempts: needsHardNavigation ? 80 : 40,
      msBetween: 50,
    })
  }

  if (needsHardNavigation) {
    window.location.assign(target)
    return
  }

  router.push(target)
  router.refresh()
}
