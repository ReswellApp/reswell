import { Banknote, Camera, Truck } from "lucide-react"
import { SellerResourcesValueStrip } from "@/components/features/seller-resources/seller-resources-value-strip"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"

const VALUES = [
  {
    icon: Camera,
    title: "List in minutes",
    body: "Photos, details, and a price. Pickup, shipping, or both. Listing is always free.",
  },
  {
    icon: Truck,
    title: "Simple shipping",
    body: "Turn on Reswell shipping, enter your box size, and the buyer pays the live label at checkout.",
  },
  {
    icon: Banknote,
    title: "Keep most of the sale",
    body: `Reswell takes ${MARKETPLACE_FEE_PERCENT}% of the item price when it sells. You keep ${SELLER_SHARE_PERCENT}%. Shipping is not fee'd.`,
  },
] as const

export function HowToSellValueStrip() {
  return <SellerResourcesValueStrip items={VALUES} />
}
