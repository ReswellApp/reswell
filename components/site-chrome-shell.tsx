import { Suspense, type ReactNode } from "react"
import { SiteChromeClient } from "@/components/site-chrome-client"
import { SiteChrome } from "@/components/site-chrome"
import type { SiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"

const ANONYMOUS_SITE_CHROME_AUTH: SiteChromeAuthPayload = {
  user: null,
  bootstrap: null,
}

/**
 * Keeps `cookies()` inside a Suspense boundary so public marketplace pages can
 * prerender / ISR while signed-in header bootstrap streams in separately.
 */
export function SiteChromeShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <SiteChromeClient headerAuth={ANONYMOUS_SITE_CHROME_AUTH}>{children}</SiteChromeClient>
      }
    >
      <SiteChrome>{children}</SiteChrome>
    </Suspense>
  )
}
