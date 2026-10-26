import {
  SurfboardBottomIcon,
  SurfboardDeckIcon,
  SurfboardDingIcon,
  SurfboardRailsIcon,
  SurfboardTailIcon,
} from "@/components/features/sell/sell-photo-example-icons"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { SellerResourcesHowCard } from "@/components/features/seller-resources/seller-resources-how-card"
import { HOW_TO_SELL_WALKTHROUGH, HOW_TO_SELL_WALKTHROUGH_LEAD } from "@/lib/seller-resource-copy"

const SHOTS = [
  { title: "Full deck", Icon: SurfboardDeckIcon },
  { title: "Bottom and fins", Icon: SurfboardBottomIcon },
  { title: "Rails", Icon: SurfboardRailsIcon },
  { title: "Nose and tail", Icon: SurfboardTailIcon },
  { title: "Honest dings", Icon: SurfboardDingIcon },
] as const

const STEPS = HOW_TO_SELL_WALKTHROUGH.map((step, index) => ({
  ...step,
  visual:
    index === 1 ? (
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
    ) : undefined,
}))

export function HowToSellListingWalkthrough() {
  return (
    <HowToSellSection
      id="list"
      eyebrow="How it works"
      title="List a board in a few minutes"
      lead={HOW_TO_SELL_WALKTHROUGH_LEAD}
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
