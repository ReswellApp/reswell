import Link from "next/link"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { HOW_TO_SHIP_HREF } from "@/lib/seller-resources"
import {
  HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN,
  HOW_TO_SELL_BOX_DIM_FORMULA,
  HOW_TO_SELL_BOX_GUIDE_SIZES,
  HOW_TO_SELL_BOX_LARGE_PACKAGE_DIM_IN,
  howToSellBoxDimLine,
  type HowToSellBoxGuideRateBand,
} from "@/lib/seller-resources-box-guide"
import { cn } from "@/lib/utils"

const BAND_CLASS: Record<HowToSellBoxGuideRateBand, string> = {
  best: "border-listingHeart/25 bg-listingHeart/5",
  higher: "border-border bg-[#F8FAFD]",
  freight: "border-border bg-[#F4F7FB]",
}

const BADGE_CLASS: Record<HowToSellBoxGuideRateBand, string> = {
  best: "bg-listingHeart/15 text-listingHeart",
  higher: "bg-amber-100 text-amber-900",
  freight: "bg-[#001A4A]/10 text-[#001A4A]",
}

export function HowToSellBoxGuide() {
  return (
    <HowToSellSection
      id="boxes"
      eyebrow="Box sizes"
      title="The carton that keeps rates low"
      lead={
        <>
          Carriers price by {HOW_TO_SELL_BOX_DIM_FORMULA}. Stay at or under{" "}
          {HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN}″ length with a 22×5 profile. Crossing{" "}
          {HOW_TO_SELL_BOX_LARGE_PACKAGE_DIM_IN}″ DIM is where most shortboard quotes jump. After
          the sale, see{" "}
          <Link href={HOW_TO_SHIP_HREF} className="font-medium text-[#001A4A] underline underline-offset-2">
            How to Ship
          </Link>
          .
        </>
      }
    >
      <ul className="grid gap-3 md:grid-cols-2">
        {HOW_TO_SELL_BOX_GUIDE_SIZES.map((size) => (
          <li
            key={size.id}
            className={cn("rounded-[1.5rem] border px-5 py-5", BAND_CLASS[size.rateBand])}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold text-[#001A4A]">{size.name}</p>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                  BADGE_CLASS[size.rateBand],
                )}
              >
                {size.badge}
              </span>
            </div>
            <p className="mt-2 font-headline text-3xl font-bold tabular-nums tracking-tight text-[#001A4A]">
              {size.lengthIn}×{size.widthIn}×{size.heightIn}
              <span className="ml-1 text-base font-semibold text-[#5c6b89]">in</span>
            </p>
            <p className="mt-1 text-xs font-medium text-[#5574AD]">{howToSellBoxDimLine(size)}</p>
            <p className="mt-3 text-sm leading-relaxed text-[#5c6b89]">
              <span className="font-medium text-[#001A4A]">Fits: </span>
              {size.fits}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[#5c6b89]">{size.note}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-sm text-[#5c6b89]">
        Preview a lane with the{" "}
        <Link
          href="/shipping-estimator"
          className="font-medium text-[#001A4A] underline underline-offset-2"
        >
          shipping estimator
        </Link>
        . Recyclable cartons:{" "}
        <a
          href="https://anewearthproject.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#001A4A] underline underline-offset-2"
        >
          A New Earth Project
        </a>
        .
      </p>
    </HowToSellSection>
  )
}
