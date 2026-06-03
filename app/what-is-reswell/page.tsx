import { AboutPageContent } from "@/components/features/about/about-page-content"
import { loadAboutPageData } from "@/lib/services/aboutPage"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("what-is-reswell")
}

export default async function WhatIsReswellPage() {
  const { stats, heroListingImages } = await loadAboutPageData()

  return (
    <main className="flex-1">
      <AboutPageContent stats={stats} heroListingImages={heroListingImages} />
    </main>
  )
}
