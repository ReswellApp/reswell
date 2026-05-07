import { SiteChromeClient } from "@/components/site-chrome-client"
import { getSiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"

/**
 * **Server-first site chrome**: one validated `getUser()` + parallel header bootstrap per request,
 * then hydrates the client shell (see `SiteChromeClient`).
 */
export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const headerAuth = await getSiteChromeAuthPayload()
  return <SiteChromeClient headerAuth={headerAuth}>{children}</SiteChromeClient>
}
