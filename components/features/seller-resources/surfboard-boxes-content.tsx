import Link from "next/link"
import { Package, Ruler, Store } from "lucide-react"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { SurfboardBoxSources } from "@/components/features/seller-resources/surfboard-box-sources"
import { SellerResourcesCta } from "@/components/features/seller-resources/seller-resources-cta"
import { SellerResourcesHero } from "@/components/features/seller-resources/seller-resources-hero"
import { SellerResourcesHowCard } from "@/components/features/seller-resources/seller-resources-how-card"
import { SellerResourcesValueStrip } from "@/components/features/seller-resources/seller-resources-value-strip"
import {
  HOW_TO_SELL_BEST_RATE_BOX,
  HOW_TO_SELL_LARGE_PARCEL_CLIFF,
  HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD,
} from "@/lib/seller-resources-box-guide"
import { HOW_TO_SELL_HREF, HOW_TO_SHIP_HREF } from "@/lib/seller-resources"

const VALUES = [
  {
    icon: Ruler,
    title: "Measure the board",
    body: "Length, widest point, and thickness with the fins off when you can remove them.",
  },
  {
    icon: Package,
    title: "Use a snug carton",
    body: "A telescoping board box slides to the length. A moving box that is too wide costs more to ship.",
  },
  {
    icon: Store,
    title: "Shop, partner, or catalog",
    body: "One board usually comes from a local shop. A case is worth ordering from a board-box company.",
  },
] as const

const STEPS = [
  {
    title: "Start with a carton you already have",
    body: "If the board came in a box and the walls are still stiff, reuse it. Take the fins off when you can so the carton stays shallow.",
  },
  {
    title: "Ask a surf shop",
    body: "Shops unpack new boards all week. A spare carton is usually the fastest way to ship a single board.",
  },
  {
    title: "Order a set if you ship often",
    body: "A New Earth Project sells a recyclable system made for boards. Uline sells a stock telescopic surfboard carton from a national catalog.",
  },
  {
    title: "Measure the sealed box",
    body: "Put the real outer length, width, height, and weight on the listing. Reswell buys the label from those numbers after the sale.",
  },
] as const

export function SurfboardBoxesContent() {
  const box = HOW_TO_SELL_BEST_RATE_BOX
  const cliff = HOW_TO_SELL_LARGE_PARCEL_CLIFF
  const boxLabel = `${box.lengthIn}×${box.widthIn}×${box.heightIn}`

  return (
    <main className="flex-1 bg-white">
      <SellerResourcesHero
        title="Get a box that fits the board"
        description="Where to find a surfboard carton, which companies are worth ordering from, and the packed size that keeps the label in the cheaper band."
        primaryCta={{ href: HOW_TO_SHIP_HREF, label: "How to pack and ship" }}
        secondaryCta={{ href: "/shipping-estimator", label: "Shipping estimator" }}
      />

      <SellerResourcesValueStrip items={VALUES} />

      <HowToSellSection
        id="how-to-get"
        eyebrow="How to get one"
        title="Four ways to end up with a carton"
        lead="You do not need a new box for every sale. Start with what you have, then order only if you will ship more than one."
      >
        <ol className="space-y-5">
          {STEPS.map((step, index) => (
            <SellerResourcesHowCard key={step.title} step={index + 1} title={step.title}>
              {step.body}
            </SellerResourcesHowCard>
          ))}
        </ol>
      </HowToSellSection>

      <HowToSellSection
        id="where-to-buy"
        wash
        eyebrow="Where to buy"
        title="Companies worth ordering from"
        lead="A New Earth Project is the one built for surfboards. Uline is the straightforward catalog order. A local shop still wins for a single board."
      >
        <SurfboardBoxSources />
      </HowToSellSection>

      <HowToSellSection
        id="size"
        eyebrow="What to order"
        title={`Stay at or under ${boxLabel}`}
        lead={`A telescoping carton lets you shorten the length. It does not let you shrink the height. Crossing ${cliff.lengthIn}″ long, ${cliff.widthIn}″ wide, or ${cliff.heightIn}″ high usually adds about $${HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD.jump}.`}
      >
        <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-[#5c6b89] sm:text-base">
          Pack to that carton, then confirm a sample rate on the{" "}
          <Link
            href={`${HOW_TO_SELL_HREF}#boxes`}
            className="font-medium text-[#001A4A] underline underline-offset-2"
          >
            box size guide
          </Link>
          . The packing walkthrough is on{" "}
          <Link href={HOW_TO_SHIP_HREF} className="font-medium text-[#001A4A] underline underline-offset-2">
            How to Ship
          </Link>
          .
        </p>
      </HowToSellSection>

      <SellerResourcesCta />
    </main>
  )
}
