import { Banknote, Camera, Truck } from "lucide-react"
import { SellerResourcesValueStrip } from "@/components/features/seller-resources/seller-resources-value-strip"
import { HOW_TO_SELL_VALUES } from "@/lib/seller-resource-copy"

const ICONS = [Camera, Truck, Banknote] as const
const VALUES = HOW_TO_SELL_VALUES.map((item, index) => ({ ...item, icon: ICONS[index]! }))

export function HowToSellValueStrip() {
  return <SellerResourcesValueStrip items={VALUES} />
}
