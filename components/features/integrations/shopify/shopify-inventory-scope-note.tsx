import { ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function ShopifyInventoryScopeNote() {
  return (
    <Card className="border-primary/15 bg-primary/[0.03]">
      <CardContent className="flex gap-3 p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">Inventory-only access</p>
          <p className="text-muted-foreground">
            Reswell does not read or sync Shopify orders, customers, payments,
            fulfillments, cancellations, or refunds. A Reswell sale only
            decrements the linked Shopify inventory item.
          </p>
          <p className="text-muted-foreground">
            Shopify stays the source of truth for titles, prices, images,
            variants, and stock. Deleting a product or variant in Shopify takes
            its Reswell listing off the marketplace.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
