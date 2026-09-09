import type { ReactNode } from "react"
import Link from "next/link"
import {
  SurfboardBottomIcon,
  SurfboardDeckIcon,
  SurfboardDingIcon,
  SurfboardRailsIcon,
  SurfboardTailIcon,
} from "@/components/features/sell/sell-photo-example-icons"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { SellerResourcesHowCard } from "@/components/features/seller-resources/seller-resources-how-card"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"
import {
  HOW_TO_SELL_BEST_RATE_BOX,
  HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN,
} from "@/lib/seller-resources-box-guide"

const SHOTS = [
  { title: "Full deck", Icon: SurfboardDeckIcon },
  { title: "Bottom and fins", Icon: SurfboardBottomIcon },
  { title: "Rails", Icon: SurfboardRailsIcon },
  { title: "Nose and tail", Icon: SurfboardTailIcon },
  { title: "Honest dings", Icon: SurfboardDingIcon },
] as const

const STEPS: {
  title: string
  body: ReactNode
  visual?: ReactNode
}[] = [
  {
    title: "Open Sell",
    body: (
      <>
        Go to{" "}
        <Link href="/sell" className="font-medium text-[#001A4A] underline underline-offset-2">
          Sell
        </Link>
        . Search the catalog by brand or model to pre-fill the form, or start a surfboard from
        scratch at{" "}
        <Link
          href={SURFBOARD_SELL_BOARDS_CREATE_HREF}
          className="font-medium text-[#001A4A] underline underline-offset-2"
        >
          /sell/boards
        </Link>
        . You can save a draft and come back.
      </>
    ),
  },
  {
    title: "Snap the photos buyers need",
    body: "Natural light, a clean background, and up to 12 photos. Drag the strongest deck shot first. These are the angles that sell a board.",
    visual: (
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {SHOTS.map((shot) => (
          <li
            key={shot.title}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white px-3 py-4 text-center"
          >
            <shot.Icon className="h-12 w-12 text-[#001A4A]" />
            <p className="text-sm font-semibold text-[#001A4A]">{shot.title}</p>
          </li>
        ))}
      </ul>
    ),
  },
  {
    title: "Add details and set your price",
    body: (
      <>
        Title, condition, shape, length, and an honest description. Optionally allow offers or
        drop the price in two weeks. Check{" "}
        <Link href="/sold" className="font-medium text-[#001A4A] underline underline-offset-2">
          recently sold
        </Link>{" "}
        for similar brand, size, and condition.
      </>
    ),
  },
  {
    title: "Turn on shipping and size the box",
    body: (
      <>
        Pin your location, then offer Reswell shipping, pickup, or both. Enter the outer box you
        will pack into — not the bare board. {HOW_TO_SELL_BEST_RATE_BOX.lengthIn}×
        {HOW_TO_SELL_BEST_RATE_BOX.widthIn}×{HOW_TO_SELL_BEST_RATE_BOX.heightIn} and anything
        under {HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN}″ length gets the best rates.
      </>
    ),
  },
  {
    title: "Publish",
    body: "Hit Create Listing. It is free to post. Buyers can favorite it, message you, make an offer if you allow them, or buy at your price.",
  },
]

export function HowToSellListingWalkthrough() {
  return (
    <HowToSellSection
      id="list"
      eyebrow="How it works"
      title="List a board in a few minutes"
      lead="Surfboards use a four-step flow on Sell: product info, photos, pricing, then shipping. Stay in Guided mode the first time."
    >
      <ol className="space-y-5">
        {STEPS.map((step, index) => (
          <SellerResourcesHowCard
            key={step.title}
            step={index + 1}
            title={step.title}
            visual={step.visual}
          >
            {step.body}
          </SellerResourcesHowCard>
        ))}
      </ol>
    </HowToSellSection>
  )
}
