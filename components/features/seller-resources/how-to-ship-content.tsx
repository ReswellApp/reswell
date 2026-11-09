import {
  HowToShipClose,
  HowToShipOptions,
  HowToShipQuestions,
} from "@/components/features/seller-resources/how-to-ship-close"
import { HowToShipAfterSale } from "@/components/features/seller-resources/how-to-ship-after-sale"
import { HowToShipBoxes } from "@/components/features/seller-resources/how-to-ship-boxes"
import { HowToShipHero } from "@/components/features/seller-resources/how-to-ship-hero"
import { HowToShipPackGuide } from "@/components/features/seller-resources/how-to-ship-pack-guide"
import { HowToShipValueStrip } from "@/components/features/seller-resources/how-to-ship-value-strip"

export function HowToShipContent() {
  return (
    <main className="flex-1 bg-white">
      <HowToShipHero />
      <HowToShipValueStrip />
      <HowToShipBoxes />
      <HowToShipPackGuide />
      <HowToShipAfterSale />
      <HowToShipOptions />
      <HowToShipQuestions />
      <HowToShipClose />
    </main>
  )
}
