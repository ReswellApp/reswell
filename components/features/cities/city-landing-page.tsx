import { Suspense } from "react"
import { CityLandingView } from "@/components/features/cities/city-landing-view"
import type { CityLandingPageData } from "@/lib/types/city-landing"

export function CityLandingPage({ data }: { data: CityLandingPageData }) {
  return (
    <main className="flex-1">
      <Suspense fallback={null}>
        <CityLandingView data={data} />
      </Suspense>
    </main>
  )
}
