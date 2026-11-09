import Link from "next/link"
import {
  pricingAllModelsClassName,
  pricingBuyClassName,
  pricingListingsClassName,
  pricingSellClassName,
} from "@/components/features/pricing/pricing-brand-styles"
import type { ModelPricingViewModel } from "@/lib/pricing/model-pricing"

export function ModelPricingActions({ page }: { page: ModelPricingViewModel }) {
  return (
    <div className="flex flex-col gap-3">
      {page.buy ? (
        <Link href={page.buy.href} className={pricingBuyClassName}>
          {page.buy.label}
        </Link>
      ) : null}
      <Link href={page.listingsHref} className={pricingListingsClassName}>
        View listings
      </Link>
      <Link href={page.sellHref} className={pricingSellClassName}>
        Sell yours
      </Link>
      <Link href={page.allModelsHref} className={pricingAllModelsClassName}>
        View all models
      </Link>
    </div>
  )
}
