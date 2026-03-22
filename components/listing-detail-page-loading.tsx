import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

type SurfboardPageLoadingProps = {
  /**
   * When false, only the main loading strip is rendered (for segment layouts that
   * already include Header + Footer via `SiteChrome` in the root layout).
   */
  withShell?: boolean
}

export function SurfboardPageLoading({ withShell = true }: SurfboardPageLoadingProps = {}) {
  const main = (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-cerulean/[0.06] via-background to-muted/30 px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">Loading…</p>
    </main>
  )

  if (!withShell) {
    return main
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      {main}
      <Footer />
    </div>
  )
}

/** @deprecated Use SurfboardPageLoading */
export const ListingDetailPageLoading = SurfboardPageLoading
