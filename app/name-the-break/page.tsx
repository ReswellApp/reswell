import type { Metadata } from "next"
import { NameTheBreakGame } from "@/components/features/games/name-the-break-game"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("name-the-break")
}

export default function NameTheBreakPage() {
  return (
    <main className="flex-1 bg-background">
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(210_40%_96%)_0%,_transparent_55%),linear-gradient(180deg,_hsl(210_25%_98%)_0%,_hsl(var(--background))_48%)]"
        />
        <div className="relative">
          <NameTheBreakGame />
        </div>
      </div>
    </main>
  )
}
