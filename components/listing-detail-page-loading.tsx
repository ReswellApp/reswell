import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { cn } from "@/lib/utils"

/** Minimal surfboard outline (side profile) for global route loading. */
function SurfboardMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-cerulean", className)}
      aria-hidden
    >
      <title>Loading</title>
      {/* Board outline */}
      <path
        d="M100 24c32 48 48 112 48 156s-16 108-48 156c-32-48-48-112-48-156s16-108 48-156Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        className="animate-pulse"
      />
      {/* Stringer / center line */}
      <path
        d="M100 52v256"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.35}
      />
      {/* Fin hint */}
      <path
        d="M100 268l-12 28h24l-12-28Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity={0.45}
        className="animate-pulse"
        style={{ animationDelay: "150ms" }}
      />
    </svg>
  )
}

export function SurfboardPageLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-cerulean/[0.06] via-background to-muted/30 px-6 py-16">
        <SurfboardMark className="h-44 w-24 sm:h-52 sm:w-28" />
        <p className="mt-8 text-sm font-medium text-muted-foreground">Loading…</p>
      </main>
      <Footer />
    </div>
  )
}

/** @deprecated Use SurfboardPageLoading */
export const ListingDetailPageLoading = SurfboardPageLoading
