import { SiteChromeClient } from "@/components/site-chrome-client"

const ANONYMOUS_HEADER_AUTH = { user: null, bootstrap: null } as const

/**
 * Public HTML is the same for every visitor. Signed-in header state hydrates
 * in `Header` / `SiteChromeClient` from the browser session so this layout
 * stays out of the Full Route Cache's dynamic APIs.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <SiteChromeClient headerAuth={ANONYMOUS_HEADER_AUTH} initialImpersonation={null}>
      {children}
    </SiteChromeClient>
  )
}
