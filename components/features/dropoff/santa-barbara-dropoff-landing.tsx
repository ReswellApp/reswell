import Link from "next/link"
import { MapPin, Package, Truck } from "lucide-react"
import {
  SantaBarbaraDropoffSizes,
  SantaBarbaraDropoffWhy,
} from "@/components/features/dropoff/santa-barbara-dropoff-details"
import { SantaBarbaraDropoffHero } from "@/components/features/dropoff/santa-barbara-dropoff-hero"
import {
  SantaBarbaraShippedBoardsSlider,
  type SantaBarbaraShippedBoard,
} from "@/components/features/dropoff/santa-barbara-shipped-boards-slider"
import { SellerResourcesCta } from "@/components/features/seller-resources/seller-resources-cta"
import { SellerResourcesHowCard } from "@/components/features/seller-resources/seller-resources-how-card"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { MadeWithLoveSantaBarbara } from "@/components/made-with-love-santa-barbara"
import { cityLandingHref } from "@/lib/city-landing-path"
import { SANTA_BARBARA_DROPOFF_SLUG } from "@/lib/dropoff-santa-barbara"
import { marketplaceFeedHref } from "@/lib/marketplace-feed-tab"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"

const STEPS = [
  {
    title: "List and choose Santa Barbara",
    body: "Add photos, details, and a price. When you get to packing, choose drop off in Santa Barbara — we pack and ship it. You do not enter a box size.",
  },
  {
    title: "Go live with shipping",
    body: "The listing offers shipping so buyers outside town can check out. A board that sat on local pickup can find someone hunting that exact shape in another state.",
  },
  {
    title: "We send drop-off details",
    body: "After it sells, you get the location on the sale page and by email. We do not publish the street address on this site.",
  },
  {
    title: "Drop it off — we ship it",
    body: "Bring the board in. Reswell packs it, buys the label, and ships it to the buyer. You get paid the same way as any other Reswell sale.",
  },
] as const

const VALUES = [
  {
    icon: MapPin,
    title: "Stay local, sell farther",
    body: "You drop the board off in Santa Barbara. The buyer can be anywhere we ship.",
  },
  {
    icon: Package,
    title: "We handle the box",
    body: "No carton run, no nose-and-tail pad job, no label print. That is the whole point.",
  },
  {
    icon: Truck,
    title: "Shipping after it sells",
    body: "Nothing leaves until a buyer checks out. Then we pack it and send it on.",
  },
] as const

export function SantaBarbaraDropoffLanding({
  shippedBoards,
}: {
  shippedBoards: SantaBarbaraShippedBoard[]
}) {
  return (
    <main className="flex-1 bg-white">
      <SantaBarbaraDropoffHero />

      <section className="border-y border-border bg-white">
        <ul className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col items-center text-center">
              <Icon className="h-11 w-11 text-[#5574AD]" strokeWidth={1.75} aria-hidden />
              <h2 className="mt-4 text-xl font-bold tracking-tight text-[#001A4A]">{title}</h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#5c6b89]">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <SantaBarbaraDropoffWhy />

      <HowToSellSection
        id="how-it-works"
        className="scroll-mt-24"
        eyebrow="How it works"
        title="Choose Santa Barbara when you list"
        lead="Four steps. The address only shows up after a buyer pays."
      >
        <ol className="grid gap-5 lg:grid-cols-2">
          {STEPS.map((step, index) => (
            <SellerResourcesHowCard key={step.title} step={index + 1} title={step.title}>
              {step.body}
            </SellerResourcesHowCard>
          ))}
        </ol>
      </HowToSellSection>

      <SantaBarbaraDropoffSizes />

      {shippedBoards.length > 0 ? (
        <HowToSellSection
          wash
          eyebrow="Shipped on Reswell"
          title="Boards that already traveled"
          lead="Recent surfboards buyers paid to have shipped. This is the audience drop-off opens up."
        >
          <SantaBarbaraShippedBoardsSlider boards={shippedBoards} />
          <p className="mt-8 text-center">
            <Link
              href={marketplaceFeedHref("shipped")}
              className="text-sm font-semibold text-[#001A4A] underline underline-offset-2"
            >
              See more shipped boards
            </Link>
          </p>
        </HowToSellSection>
      ) : null}

      <SellerResourcesCta
        title="List it and choose Santa Barbara"
        description="Free to post. After it sells, drop it off — we pack and ship it."
        href={SURFBOARD_SELL_BOARDS_CREATE_HREF}
        label="Start a listing"
      />

      <div className="bg-[#001A4A] px-4 pb-10 text-center">
        <MadeWithLoveSantaBarbara />
        <p className="mt-2 text-sm text-white/60">
          Looking to buy locally?{" "}
          <Link
            href={cityLandingHref(SANTA_BARBARA_DROPOFF_SLUG)}
            className="font-medium text-white underline underline-offset-2"
          >
            Browse Santa Barbara boards
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
