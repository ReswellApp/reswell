import { HowToSellBoxRateCalculator } from "@/components/features/seller-resources/how-to-sell-box-rate-calculator"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import {
  HOW_TO_SELL_BEST_RATE_BOX,
  HOW_TO_SELL_BEST_RATE_TYPICAL_USD,
  HOW_TO_SELL_BOX_CALCULATOR_PRESETS,
  HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD,
  howToSellBoxPresetToEstimator,
} from "@/lib/seller-resources-box-guide"

const BOX_ESTIMATOR_PRESETS = HOW_TO_SELL_BOX_CALCULATOR_PRESETS.map(howToSellBoxPresetToEstimator)
const BEST_RATE_WEIGHT_LB = String(HOW_TO_SELL_BOX_CALCULATOR_PRESETS[0]?.weightLb ?? 14)

export function HowToSellBoxGuide() {
  const box = HOW_TO_SELL_BEST_RATE_BOX
  const cheap = HOW_TO_SELL_BEST_RATE_TYPICAL_USD
  const expensive = HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD
  const boxLabel = `${box.lengthIn}×${box.widthIn}×${box.heightIn}`

  return (
    <HowToSellSection
      id="boxes"
      wash
      title="Best box sizes"
      lead={`Stay at or under ${boxLabel}. One inch over usually adds about $${expensive.jump}.`}
    >
      <dl className="mx-auto max-w-xs space-y-3">
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-sm text-[#5c6b89]">{boxLabel}</dt>
          <dd className="font-headline text-xl font-bold tabular-nums tracking-tight text-[#001A4A]">
            ${cheap.inStateLow}–${cheap.crossCountry}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-sm text-[#5c6b89]">One inch over</dt>
          <dd className="font-headline text-xl font-bold tabular-nums tracking-tight text-[#001A4A]">
            ${expensive.low}–${expensive.high}
          </dd>
        </div>
      </dl>

      <details className="mx-auto mt-8 max-w-lg">
        <summary className="cursor-pointer list-none text-center text-sm font-medium text-[#001A4A] underline underline-offset-2 [&::-webkit-details-marker]:hidden">
          Check a sample rate
        </summary>
        <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <HowToSellBoxRateCalculator
            idPrefix="how-to-sell-box-est"
            defaultLengthIn={String(box.lengthIn)}
            defaultWidthIn={String(box.widthIn)}
            defaultHeightIn={String(box.heightIn)}
            defaultWeightLb={BEST_RATE_WEIGHT_LB}
            presets={BOX_ESTIMATOR_PRESETS}
          />
        </div>
      </details>
    </HowToSellSection>
  )
}
