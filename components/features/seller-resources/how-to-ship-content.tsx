import Link from "next/link"
import { MapPin, Package, Printer } from "lucide-react"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { SellerResourcesCta } from "@/components/features/seller-resources/seller-resources-cta"
import { SellerResourcesHero } from "@/components/features/seller-resources/seller-resources-hero"
import { SellerResourcesHowCard } from "@/components/features/seller-resources/seller-resources-how-card"
import { SellerResourcesValueStrip } from "@/components/features/seller-resources/seller-resources-value-strip"
import { HOW_TO_SELL_HREF } from "@/lib/seller-resources"
import { SANTA_BARBARA_DROPOFF_HREF } from "@/lib/dropoff-santa-barbara"
import {
  HOW_TO_SHIP_AFTER_SALE,
  HOW_TO_SHIP_AFTER_SALE_LEAD,
  HOW_TO_SHIP_DROPOFF,
  HOW_TO_SHIP_HERO,
  HOW_TO_SHIP_PACK_LEAD,
  HOW_TO_SHIP_PICKUP,
  HOW_TO_SHIP_VALUES,
} from "@/lib/seller-resource-copy"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"

const VALUE_ICONS = [MapPin, Package, Printer] as const
const VALUES = HOW_TO_SHIP_VALUES.map((item, index) => ({ ...item, icon: VALUE_ICONS[index]! }))
const AFTER_SALE = HOW_TO_SHIP_AFTER_SALE

export function HowToShipContent() {
  return (
    <main className="flex-1 bg-white">
      <SellerResourcesHero
        title={HOW_TO_SHIP_HERO.title}
        description={HOW_TO_SHIP_HERO.description}
        primaryCta={{ href: SURFBOARD_SELL_BOARDS_CREATE_HREF, label: "Start a listing" }}
        secondaryCta={{ href: "/shipping-estimator", label: "Shipping estimator" }}
      />

      <SellerResourcesValueStrip items={VALUES} />

      <HowToSellSection
        id="after-sale"
        eyebrow="How it works"
        title="After a board sells"
        lead={HOW_TO_SHIP_AFTER_SALE_LEAD}
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
            {HOW_TO_SHIP_PACK_LEAD}{" "}
            <Link href={`${HOW_TO_SELL_HREF}#boxes`} className="font-medium text-[#001A4A] underline underline-offset-2">
              Box size guide
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
        id="dropoff"
        wash
        eyebrow="Santa Barbara"
        title="Drop it off if you would rather not pack"
        lead={
          <>
            {HOW_TO_SHIP_DROPOFF}{" "}
            <Link
              href={SANTA_BARBARA_DROPOFF_HREF}
              className="font-medium text-[#001A4A] underline underline-offset-2"
            >
              How Santa Barbara drop-off works
            </Link>
            .
          </>
        }
      />

      <HowToSellSection
        id="pickup"
        eyebrow="Local pickup"
        title="Meet locally if you prefer"
        lead={HOW_TO_SHIP_PICKUP}
      />

      <SellerResourcesCta />
    </main>
  )
}
