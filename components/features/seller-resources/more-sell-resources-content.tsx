import Link from "next/link"
import { BookOpen, Map, Package } from "lucide-react"
import { helpArticlePath, helpTopicPath } from "@/lib/help-center/paths"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { SellerResourcesCta } from "@/components/features/seller-resources/seller-resources-cta"
import { SellerResourcesHero } from "@/components/features/seller-resources/seller-resources-hero"
import {
  HOW_TO_SELL_HREF,
  HOW_TO_SHIP_HREF,
  SALES_MAP_HREF,
  sellerResourcesComingSoon,
} from "@/lib/seller-resources"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"

const PRIMARY = [
  {
    title: "How to Sell",
    href: HOW_TO_SELL_HREF,
    body: "Photo examples, the Sell walkthrough, box sizes, and how to build reviews.",
    icon: BookOpen,
  },
  {
    title: "How to Ship",
    href: HOW_TO_SHIP_HREF,
    body: "Offer shipping, pack a board, print a label, or meet for pickup.",
    icon: Package,
  },
  {
    title: "Sales Map",
    href: SALES_MAP_HREF,
    body: "See where confirmed Reswell orders travel from seller state to buyer state.",
    icon: Map,
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
    <main className="flex-1 bg-white">
      <SellerResourcesHero
        title="Everything you need to sell"
        description="Guides, tools, and the rest of the seller desk. Pricing Hub and the Sell-Out List will land here when we have the data."
        primaryCta={{ href: SURFBOARD_SELL_BOARDS_CREATE_HREF, label: "Start a listing" }}
        secondaryCta={{ href: HOW_TO_SELL_HREF, label: "How to Sell" }}
      />

      <HowToSellSection
        eyebrow="Guides"
        title="Start with the basics"
        lead="How to list, how to ship, and where boards are actually selling."
      >
        <ul className="grid gap-5 md:grid-cols-3">
          {PRIMARY.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col rounded-[1.75rem] bg-[#F4F7FB] px-6 py-8 transition-colors hover:bg-[#eef2f8]"
                >
                  <Icon className="h-10 w-10 text-[#5574AD]" strokeWidth={1.75} aria-hidden />
                  <p className="mt-5 text-xl font-bold tracking-tight text-[#001A4A]">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#5c6b89]">{item.body}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      </HowToSellSection>

      <HowToSellSection
        wash
        eyebrow="Coming next"
        title="More seller tools on the way"
      >
        <ul className="grid gap-5 md:grid-cols-2">
          {sellerResourcesComingSoon.map((item) => (
            <li key={item.label} className="rounded-[1.75rem] bg-white px-6 py-8 ring-1 ring-border">
              <p className="flex flex-wrap items-center gap-2 text-xl font-bold text-[#001A4A]">
                {item.label}
                <span className="rounded-full bg-[#5574AD]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#5574AD]">
                  Soon
                </span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#5c6b89]">{item.description}</p>
            </li>
          ))}
        </ul>
      </HowToSellSection>

      <HowToSellSection
        eyebrow="More"
        title="Guides and tools"
        lead="Fees, payouts, protection, and the shipping estimator."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {GUIDES.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-[1.25rem] bg-[#F4F7FB] px-5 py-4 font-semibold text-[#001A4A] transition-colors hover:bg-[#eef2f8]"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </HowToSellSection>

      <SellerResourcesCta />
    </main>
  )
}
