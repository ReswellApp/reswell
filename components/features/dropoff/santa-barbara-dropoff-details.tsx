import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { formatDropoffBoxSize } from "@/lib/dropoff-location-box-rules"
import { SANTA_BARBARA_DROPOFF_BOX_RULES } from "@/lib/dropoff-santa-barbara"

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
            <li>Anyone listing a board who wants nationwide reach.</li>
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
      lead="We pack every Santa Barbara drop-off. The carton depends on board length, and width does not change the box."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {SANTA_BARBARA_DROPOFF_BOX_RULES.map((rule) => (
          <div key={rule.id} className="rounded-[1.75rem] bg-[#F4F7FB] px-6 py-8 sm:px-8">
            <p className="text-xl font-bold tracking-tight text-[#001A4A]">{rule.label}</p>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[#5c6b89] sm:text-base">
              <li>{formatDropoffBoxSize(rule)} in</li>
              <li>{rule.weightLb} lb</li>
              <li>Any board width.</li>
            </ul>
          </div>
        ))}
      </div>
    </HowToSellSection>
  )
}
