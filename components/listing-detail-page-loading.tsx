import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export function SurfboardPageLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-cerulean/[0.06] via-background to-muted/30 px-6 py-16">
        <p className="text-sm font-medium text-muted-foreground">Loading…</p>
      </main>
      <Footer />
    </div>
  )
}

/** @deprecated Use SurfboardPageLoading */
export const ListingDetailPageLoading = SurfboardPageLoading
