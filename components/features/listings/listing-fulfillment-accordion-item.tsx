import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { listingFulfillmentPdpCopy } from "@reswell/api-contract"
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

export function ListingFulfillmentAccordionItem({
  pickupOffered,
  shippingOffered,
  locationLine,
  itemNoun,
  shippingCostMode = null,
  shippingFlatRate = 0,
  inspectBeforePay = false,
}: ListingFulfillmentAccordionItemProps) {
  const copy = listingFulfillmentPdpCopy({
    pickupOffered,
    shippingOffered,
    locationLine,
    shippingCostMode,
    shippingFlatRate,
  })

  return (
    <AccordionItem value="shipping" className="border-border/55">
      <AccordionTrigger className="py-4 text-[16px] font-medium text-foreground hover:no-underline">
        {boardFulfillmentSectionTitle(pickupOffered, shippingOffered)}
      </AccordionTrigger>
      <AccordionContent className="pb-6 pt-0">
        {copy ? (
          <div className="space-y-2 text-[16px] leading-[1.65] text-foreground">
            <p className="font-semibold">{copy.headline}</p>
            {copy.subline ? <p className="text-muted-foreground">{copy.subline}</p> : null}
            {inspectBeforePay && pickupOffered ? (
              <p className="text-[15px] text-muted-foreground">
                Meet the seller near this area to inspect the {itemNoun} before you pay.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[16px] text-muted-foreground">Delivery options are not listed for this item.</p>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
