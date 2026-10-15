import Link from "next/link"
import { HowToSellBoxGuide } from "@/components/features/seller-resources/how-to-sell-box-guide"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { SellerResourcesHowCard } from "@/components/features/seller-resources/seller-resources-how-card"
import {
  HOW_TO_SELL_BEST_RATE_BOX,
  HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN,
  HOW_TO_SELL_LARGE_PARCEL_CLIFF,
  HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD,
} from "@/lib/seller-resources-box-guide"
import { SURFBOARD_SHIPPING_DIM_FORMULA } from "@/lib/shipping/surfboard-label-limits"
import { UPS_LARGE_PACKAGE_DIM_IN } from "@/lib/shipping/ups-parcel-surcharge-flags"

const box = HOW_TO_SELL_BEST_RATE_BOX
const cliff = HOW_TO_SELL_LARGE_PARCEL_CLIFF
const boxLabel = `${box.lengthIn}×${box.widthIn}×${box.heightIn}`

const MEASURE_STEPS = [
  {
    title: "Pack it first, then measure",
    body: "Measure the outside of the sealed carton, not the board by itself. Tape, fins, and padding all count. A board that is 6′0 can leave the box longer than 6′0 once the nose and tail are padded.",
  },
  {
    title: "Length, width, and height",
    body: `Length is the longest outside edge. Width and height are the other two outside edges, including any bulge. Write down inches, then compare them to the label. Every side has to be at or under the label.`,
  },
  {
    title: "Weigh the sealed box",
    body: "Use a scale under the finished carton. The label weight is a ceiling. Extra tape, a leash, or a second set of fins can push you over.",
  },
  {
    title: "Photograph it before drop-off",
    body: "Take a photo of each side with a tape on it, plus the attached label. If a carrier later bills an adjustment, those photos are what a dispute needs.",
  },
] as const

export function HowToShipPackingGuide() {
  return (
    <>
      <HowToSellSection
        id="adjustments"
        eyebrow="Carrier adjustments"
        title="One adjustment is covered. The next one is not."
        lead="Carriers measure the box again after you drop it off. If the packed carton is larger or heavier than the label, they bill the difference."
      >
        <div className="mx-auto max-w-2xl space-y-4 text-base leading-relaxed text-[#3d4d6b]">
          <p>
            Reswell covers the first carrier adjustment on your account. You will see that on the
            sale, and nothing is taken from that sale.
          </p>
          <p>
            The next adjustment on a shipped item is deducted from your total earnings on that
            sale. It is separate from the shipping the buyer already paid. The buyer&apos;s label
            price does not change.
          </p>
          <p>
            The usual cause is a carton that grew past the label: a nose pad that added an inch, a
            fin that pushed the height, or a box that was fine empty and tight once the board was
            inside. The label measurements are a limit, not a suggestion.
          </p>
        </div>
      </HowToSellSection>

      <HowToSellSection
        id="measure"
        wash
        eyebrow="Before drop-off"
        title="How to measure a packed box"
        lead="Do this with the board inside and the box taped shut. That is the package the carrier scans."
      >
        <ol className="mx-auto max-w-2xl space-y-5">
          {MEASURE_STEPS.map((step, index) => (
            <SellerResourcesHowCard key={step.title} step={index + 1} title={step.title}>
              {step.body}
            </SellerResourcesHowCard>
          ))}
        </ol>
      </HowToSellSection>

      <HowToSellSection
        id="sizes"
        eyebrow="Box sizes"
        title={`Stay at or under ${boxLabel}`}
        lead={
          <>
            {boxLabel} is the carton that keeps a shortboard in the cheaper parcel band. One inch
            over — {cliff.lengthIn}″ long, {cliff.widthIn}″ wide, or {cliff.heightIn}″ tall —
            usually jumps the label by about ${HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD.jump}.
          </>
        }
      >
        <div className="mx-auto max-w-2xl space-y-4 text-base leading-relaxed text-[#3d4d6b]">
          <p>
            Carriers price the box with {SURFBOARD_SHIPPING_DIM_FORMULA}. At {boxLabel} that total
            is {UPS_LARGE_PACKAGE_DIM_IN}″, which is the large-package line. Crossing it is what
            turns a label that was about the rate on your listing into a bill closer to $
            {HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD.low}.
          </p>
          <p>
            Keep length at or under {HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN}″. If the board needs a
            longer carton, tell the listing the real packed size before the label is bought. A
            label bought for {boxLabel} cannot be stretched at the counter.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>One board per box. A second board belongs in its own carton and its own label.</li>
            <li>
              Fins that make the box taller than the label should ride in a small separate box, or
              the listing needs the taller size before checkout.
            </li>
            <li>Pad the nose and tail, then fill empty space so the board cannot shift and swell a side.</li>
            <li>A snug carton beats a loose one. Air around the board is what gets crushed and remeasured.</li>
          </ul>
          <p>
            The{" "}
            <Link href="/shipping-estimator" className="font-medium text-[#001A4A] underline underline-offset-2">
              shipping estimator
            </Link>{" "}
            uses the same packed size. If the estimator and the finished box disagree, the carrier
            will bill the box.
          </p>
        </div>
      </HowToSellSection>

      <HowToSellBoxGuide />
    </>
  )
}
