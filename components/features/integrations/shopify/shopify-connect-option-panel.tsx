import type { ReactNode } from "react"
import {
  shopifyBodyClass,
  shopifyNeutralBadgeClass,
  shopifySectionTitleClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"

interface ShopifyConnectOptionPanelProps {
  title: string
  badge: string
  description: string
  children: ReactNode
}

export function ShopifyConnectOptionPanel({
  title,
  badge,
  description,
  children,
}: ShopifyConnectOptionPanelProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={shopifySectionTitleClass}>{title}</h3>
        <span className={shopifyNeutralBadgeClass}>{badge}</span>
      </div>
      <p className={shopifyBodyClass}>{description}</p>
      <div>{children}</div>
    </section>
  )
}
