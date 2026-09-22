import type { ReactNode } from "react"
import { SiteChrome } from "@/components/site-chrome"

/** Anonymous shell. Auth chrome hydrates on the client after paint. */
export function SiteChromeShell({ children }: { children: ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>
}
