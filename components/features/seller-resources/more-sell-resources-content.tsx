import Link from "next/link"
import { helpArticlePath, helpTopicPath } from "@/lib/help-center/paths"
import {
  HOW_TO_SELL_HREF,
  HOW_TO_SHIP_HREF,
  SALES_MAP_HREF,
  SELLER_RESOURCES_HUB_HREF,
  sellerResourcesComingSoon,
} from "@/lib/seller-resources"
import { SellerResourceCard, SellerResourcesShell } from "./seller-resources-shell"

const PRIMARY = [
  {
    title: "How to Sell",
    href: HOW_TO_SELL_HREF,
    body: "The listing flow, photos, fees, and what happens after you publish.",
  },
  {
    title: "How to Ship",
    href: HOW_TO_SHIP_HREF,
    body: "Offer shipping, pack a board, print a label, or meet for pickup.",
  },
  {
    title: "Sales Map",
    href: SALES_MAP_HREF,
    body: "See where confirmed Reswell orders travel from seller state to buyer state.",
  },
] as const

const GUIDES = [
  { title: "Selling fees", href: helpArticlePath("selling", "marketplace-fees") },
  { title: "Connect payouts", href: helpArticlePath("selling", "connect-payout-account") },
  { title: "I made a sale — what's next?", href: helpArticlePath("selling", "i-sold-an-item-whats-next") },
  { title: "Purchase Protection", href: "/protection-policy" },
  { title: "Help Center — selling", href: helpTopicPath("selling") },
  { title: "Shipping estimator", href: "/shipping-estimator" },
] as const

export function MoreSellResourcesContent() {
  return (
    <SellerResourcesShell
      title="More Sell Resources"
      description="Guides, tools, and the rest of the seller desk. Pricing Hub and the Sell-Out List will land here when we have the data."
      currentHref={SELLER_RESOURCES_HUB_HREF}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {PRIMARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-border bg-white p-5 shadow-sm transition-colors hover:border-listingHeart/30"
          >
            <p className="font-semibold text-[#001A4A]">{item.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#5c6b89]">{item.body}</p>
          </Link>
        ))}
      </div>

      <SellerResourceCard title="Coming next">
        <ul className="space-y-3">
          {sellerResourcesComingSoon.map((item) => (
            <li key={item.label}>
              <p className="font-semibold text-[#001A4A]">
                {item.label}{" "}
                <span className="ml-1 text-xs font-medium uppercase tracking-wide text-[#5574AD]">
                  Soon
                </span>
              </p>
              <p className="mt-0.5">{item.description}</p>
            </li>
          ))}
        </ul>
      </SellerResourceCard>

      <SellerResourceCard title="More guides and tools">
        <ul className="grid gap-2 sm:grid-cols-2">
          {GUIDES.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="font-medium text-[#001A4A] underline underline-offset-2"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </SellerResourceCard>
    </SellerResourcesShell>
  )
}
