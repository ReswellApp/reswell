import type { Metadata } from "next"
import { PriceGuideHubBody } from "@/components/features/price-guide/price-guide-hub-body"
import { getCachedPriceGuideHub } from "@/lib/cache/price-guide"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { absoluteUrl } from "@/lib/site-metadata"

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("priceguide")
}

export default async function PriceGuidePage() {
  const hub = await getCachedPriceGuideHub()
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Reswell Surf Gear Price Guide",
    description:
      "Used surfboard and surf gear pricing from Reswell marketplace listings and completed sales.",
    url: absoluteUrl("/priceguide"),
    creator: { "@type": "Organization", name: "Reswell" },
    variableMeasured: ["asking price", "sold price", "typical used value"],
  }
  return (
    <main className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PriceGuideHubBody hub={hub} />
    </main>
  )
}
