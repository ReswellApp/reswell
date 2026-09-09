import Link from "next/link"
import { MapPin, Package, Printer } from "lucide-react"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { SellerResourcesCta } from "@/components/features/seller-resources/seller-resources-cta"
import { SellerResourcesHero } from "@/components/features/seller-resources/seller-resources-hero"
import { SellerResourcesHowCard } from "@/components/features/seller-resources/seller-resources-how-card"
import { SellerResourcesValueStrip } from "@/components/features/seller-resources/seller-resources-value-strip"
import { HOW_TO_SELL_HREF } from "@/lib/seller-resources"
import {
  HOW_TO_SELL_BEST_RATE_BOX,
  HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN,
} from "@/lib/seller-resources-box-guide"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"
import { SHIPPING_DEADLINE_DAYS } from "@/lib/shipping-deadline"

const VALUES = [
  {
    icon: MapPin,
    title: "Offer it when you list",
    body: "Reswell-calculated rates, a flat Continental U.S. price, or free shipping you cover. Pickup still works.",
  },
  {
    icon: Package,
    title: "Pack it so it arrives",
    body: "Pad the nose and tail, use a snug board box, and fill gaps so nothing shifts in transit.",
  },
  {
    icon: Printer,
    title: "Print the label",
    body: "After checkout, Reswell buys the label from the box size you entered. Print it from Sales.",
  },
] as const

const AFTER_SALE = [
  {
    title: "Pack it well",
    body: "Pad the nose and tail, use a snug board box, and fill gaps so nothing shifts.",
  },
  {
    title: "Get a label",
    body: (
      <>
        Open the sale from{" "}
        <Link href="/dashboard/sales" className="font-medium text-[#001A4A] underline underline-offset-2">
          Sales
        </Link>
        . Print the Reswell label when one is ready, or add your own tracking.
      </>
    ),
  },
  {
    title: "Hand it to the carrier",
    body: `Ship within ${SHIPPING_DEADLINE_DAYS} days of purchase confirmation when you can, then mark the drop-off so the buyer sees progress.`,
  },
] as const

export function HowToShipContent() {
  return (
    <main className="flex-1 bg-white">
      <SellerResourcesHero
        title="Ship it so it arrives in one piece"
        description="Offer shipping on a listing, pack the board, and get a label after the sale. Pickup-only still works if you prefer to meet locally."
        primaryCta={{ href: SURFBOARD_SELL_BOARDS_CREATE_HREF, label: "Start a listing" }}
        secondaryCta={{ href: "/shipping-estimator", label: "Shipping estimator" }}
      />

      <SellerResourcesValueStrip items={VALUES} />

      <HowToSellSection
        id="after-sale"
        eyebrow="How it works"
        title="After a board sells"
        lead="Reswell buys the carrier label from the box size on your listing. Pack to that carton, print the PDF, and drop it off."
      >
        <ol className="space-y-5">
          {AFTER_SALE.map((step, index) => (
            <SellerResourcesHowCard key={step.title} step={index + 1} title={step.title}>
              {step.body}
            </SellerResourcesHowCard>
          ))}
        </ol>
      </HowToSellSection>

      <HowToSellSection
        id="pack"
        wash
        eyebrow="Packing"
        title="How to pack a surfboard"
        lead={
          <>
            Need a box? Order a recyclable carton from{" "}
            <a
              href="https://anewearthproject.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#001A4A] underline underline-offset-2"
            >
              A New Earth Project
            </a>
            . For the best rates, pack into {HOW_TO_SELL_BEST_RATE_BOX.lengthIn}×
            {HOW_TO_SELL_BEST_RATE_BOX.widthIn}×{HOW_TO_SELL_BEST_RATE_BOX.heightIn} or stay under{" "}
            {HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN}″ length — see the{" "}
            <Link href={`${HOW_TO_SELL_HREF}#boxes`} className="font-medium text-[#001A4A] underline underline-offset-2">
              box size guide
            </Link>
            .
          </>
        }
      >
        <div className="overflow-hidden rounded-[1.75rem] bg-muted shadow-sm ring-1 ring-border">
          <iframe
            src="https://www.youtube.com/embed/NzDaFE4d9V4?start=14"
            title="How to pack a surfboard for shipping"
            className="aspect-video w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </HowToSellSection>

      <HowToSellSection
        id="pickup"
        eyebrow="Local pickup"
        title="Meet locally if you prefer"
        lead={
          <>
            Meet in public, let the buyer inspect the gear, then enter their pickup code on the
            sale page to release your payout. Read{" "}
            <Link href="/safety" className="font-medium text-[#001A4A] underline underline-offset-2">
              safety tips
            </Link>{" "}
            before you meet. Buyer-side label details live in the{" "}
            <Link href="/shipping" className="font-medium text-[#001A4A] underline underline-offset-2">
              full shipping guide
            </Link>
            .
          </>
        }
      />

      <SellerResourcesCta />
    </main>
  )
}
