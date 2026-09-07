import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { boardFulfillmentSectionTitle } from "@/lib/listing-fulfillment"

type ShippingCostMode = "reswell" | "flat" | "free"

export interface ListingFulfillmentAccordionItemProps {
  pickupOffered: boolean
  shippingOffered: boolean
  locationLine: string | null
  itemNoun: string
  shippingCostMode?: ShippingCostMode | null
  shippingFlatRate?: number
  inspectBeforePay?: boolean
}

function shippingAvailableDetail(
  shippingCostMode: ShippingCostMode | null | undefined,
  shippingFlatRate: number,
): string {
  if (shippingCostMode === "free") {
    return "available. Free shipping after checkout."
  }
  if (shippingFlatRate > 0) {
    return `available. Flat $${shippingFlatRate.toFixed(2)} shipping at checkout.`
  }
  return "available. Shipping is calculated at checkout."
}

export function ListingFulfillmentAccordionItem({
  pickupOffered,
  shippingOffered,
  locationLine,
  itemNoun,
  shippingCostMode = null,
  shippingFlatRate = 0,
  inspectBeforePay = false,
}: ListingFulfillmentAccordionItemProps) {
  return (
    <AccordionItem value="shipping" className="border-border/55">
      <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
        {boardFulfillmentSectionTitle(pickupOffered, shippingOffered)}
      </AccordionTrigger>
      <AccordionContent className="pb-6 pt-0">
        <div className="space-y-3 text-[16px] leading-[1.65] text-foreground">
          <p className="font-medium">{locationLine ?? "Location not specified"}</p>
          <ul className="space-y-2">
            <li>
              <span className="font-medium">Local pickup</span>
              {pickupOffered ? (
                <span className="text-muted-foreground">
                  {" "}
                  — available. Meet the seller near this area to inspect the {itemNoun}.
                </span>
              ) : (
                <span className="text-muted-foreground"> — not offered on this listing</span>
              )}
            </li>
            <li>
              <span className="font-medium">Shipping</span>
              {shippingOffered ? (
                <span className="text-muted-foreground">
                  {" "}
                  — {shippingAvailableDetail(shippingCostMode, shippingFlatRate)}
                </span>
              ) : (
                <span className="text-muted-foreground"> — not offered on this listing</span>
              )}
            </li>
          </ul>
          {inspectBeforePay && pickupOffered ? (
            <p>Inspect for cracks, dings, or delamination before you pay.</p>
          ) : null}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
