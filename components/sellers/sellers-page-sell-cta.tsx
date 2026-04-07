import { MarketingCtaBanner } from "@/components/marketing-cta-banners"

/** Sell CTA aligned to the same `max-w-3xl` column as the seller cards on `/sellers`. */
export function SellersPageSellCta() {
  return (
    <MarketingCtaBanner
      href="/dashboard/settings"
      title="Sell on Reswell"
      description="List your gear and reach local surfers. Set up your seller profile in minutes."
      ctaLabel="Become a seller"
      outerClassName="container mx-auto px-4"
      innerClassName="max-w-3xl"
    />
  )
}
