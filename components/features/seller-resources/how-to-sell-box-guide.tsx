import { HowToSellBoxRateCalculator } from "@/components/features/seller-resources/how-to-sell-box-rate-calculator"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import {
  HOW_TO_SELL_BEST_RATE_BOX,
  HOW_TO_SELL_BEST_RATE_FLAT_BOX,
  HOW_TO_SELL_BEST_RATE_TYPICAL_USD,
  HOW_TO_SELL_BOX_CALCULATOR_PRESETS,
  HOW_TO_SELL_LARGE_PARCEL_BOARD_LENGTH,
  HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD,
  howToSellBestBoxSizesLead,
  howToSellBoxPresetToEstimator,
  howToSellBoxSizeLabel,
} from "@/lib/seller-resources-box-guide"

const BOX_ESTIMATOR_PRESETS = HOW_TO_SELL_BOX_CALCULATOR_PRESETS.map(howToSellBoxPresetToEstimator)
const BEST_RATE_WEIGHT_LB = String(HOW_TO_SELL_BOX_CALCULATOR_PRESETS[0]?.weightLb ?? 14)

export function HowToSellBoxGuide() {
  const box = HOW_TO_SELL_BEST_RATE_BOX
  const flat = HOW_TO_SELL_BEST_RATE_FLAT_BOX
  const cheap = HOW_TO_SELL_BEST_RATE_TYPICAL_USD
  const expensive = HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD
  const cheapLabel = `$${cheap.inStateLow}–$${cheap.crossCountry}`
  const rows = [
    {
      label: `${howToSellBoxSizeLabel(box)} and under`,
      price: cheapLabel,
    },
    {
      label: howToSellBoxSizeLabel(flat),
      price: cheapLabel,
    },
    {
      label: `Larger box · ${HOW_TO_SELL_LARGE_PARCEL_BOARD_LENGTH} and over`,
      price: `$${expensive.low}–$${expensive.high}`,
    },
  ]

  return (
    <HowToSellSection
      id="boxes"
      wash
      title="Best box sizes"
      lead={howToSellBestBoxSizesLead()}
    >
      <dl className="mx-auto max-w-md space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-6">
            <dt className="text-sm text-[#5c6b89]">{row.label}</dt>
            <dd className="font-headline text-xl font-bold tabular-nums tracking-tight text-[#001A4A]">
              {row.price}
            </dd>
          </div>
        ))}
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
