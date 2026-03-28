import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { RouteTransitionMark } from "@/components/route-transition-mark"

type SurfboardPageLoadingProps = {
  /**
   * When false, only the main loading strip is rendered (for segment layouts that
   * already include Header + Footer via `SiteChrome` in the root layout).
   */
  withShell?: boolean
}

export function SurfboardPageLoading({ withShell = true }: SurfboardPageLoadingProps = {}) {
  if (!withShell) {
    return <RouteTransitionMark variant="overlay" />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <RouteTransitionMark variant="inline" />
      <Footer />
    </div>
  )
}

/** @deprecated Use SurfboardPageLoading */
export const ListingDetailPageLoading = SurfboardPageLoading
