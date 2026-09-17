import Link from "next/link"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import {
  SANTA_BARBARA_DROPOFF_MAX_LENGTH,
  SANTA_BARBARA_DROPOFF_SHORTBOARD_MAX_WIDTH,
} from "@/lib/dropoff-santa-barbara"
import { HOW_TO_SHIP_HREF } from "@/lib/seller-resources"

export function SantaBarbaraDropoffWhy() {
  return (
    <HowToSellSection
      eyebrow="Why drop-off"
      title="When local pickup is not enough"
      lead="A used surfboard that sits in town is often exactly what someone nationwide is looking for. Offering shipping from Santa Barbara is how you reach them without becoming the shipper."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[1.75rem] bg-[#F9F9F2] px-6 py-8 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
            If it has not sold locally
          </p>
          <p className="mt-3 text-lg font-semibold leading-snug text-[#001A4A] sm:text-xl">
            Keep the listing, add shipping, and let the board travel.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#5c6b89] sm:text-base">
            Pickup-only listings stay in one zip code. Santa Barbara drop-off puts your used
            surfboard in front of buyers who will pay to have it shipped — and you still only
            drive across town after it sells.
          </p>
        </div>
        <div className="rounded-[1.75rem] bg-[#F4F7FB] px-6 py-8 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
            Who this is for
          </p>
          <ul className="mt-3 space-y-3 text-sm leading-relaxed text-[#5c6b89] sm:text-base">
            <li>Sellers in and around Santa Barbara who do not want to pack a board.</li>
            <li>Boards that had interest locally but never closed.</li>
            <li>
              Anyone listing a board up to {SANTA_BARBARA_DROPOFF_MAX_LENGTH} who wants nationwide
              reach.
            </li>
          </ul>
        </div>
      </div>
    </HowToSellSection>
  )
}

export function SantaBarbaraDropoffSizes() {
  return (
    <HowToSellSection
      eyebrow="What we pack"
      title="Sizes we can ship from here"
      lead="These limits match the cartons we keep in Santa Barbara. Longer or wider boards can still sell — pack those yourself."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[1.75rem] bg-[#F4F7FB] px-6 py-8 sm:px-8">
          <p className="text-xl font-bold tracking-tight text-[#001A4A]">Boards we drop off</p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[#5c6b89] sm:text-base">
            <li>Up to {SANTA_BARBARA_DROPOFF_MAX_LENGTH} overall.</li>
            <li>
              6&apos;0 and under need to be {SANTA_BARBARA_DROPOFF_SHORTBOARD_MAX_WIDTH} wide or
              less.
            </li>
            <li>You will see this option in the sell flow when the board fits.</li>
          </ul>
        </div>
        <div className="rounded-[1.75rem] bg-[#F4F7FB] px-6 py-8 sm:px-8">
          <p className="text-xl font-bold tracking-tight text-[#001A4A]">Outside those sizes</p>
          <p className="mt-4 text-sm leading-relaxed text-[#5c6b89] sm:text-base">
            Pack and ship it yourself, or keep the listing pickup-only. The{" "}
            <Link
              href={HOW_TO_SHIP_HREF}
              className="font-medium text-[#001A4A] underline underline-offset-2"
            >
              how to ship guide
            </Link>{" "}
            covers boxes, labels, and local meetups.
          </p>
        </div>
      </div>
    </HowToSellSection>
  )
}
