import { Package } from "lucide-react"
import { ReswellTrackingSection } from "@/components/features/orders/reswell-tracking-section"
import type { PublicOrderTrackingPage } from "@/lib/services/publicOrderTracking"

export function PublicOrderTrackingView({ page }: { page: PublicOrderTrackingPage }) {
  return (
    <main className="flex-1 py-10">
      <div className="container mx-auto max-w-xl space-y-6 px-4">
        <header className="space-y-1">
          <p className="text-sm text-muted-foreground">Order #{page.orderNumber}</p>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-foreground">
            Track your package
          </h1>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Package className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span>{page.listingTitle}</span>
          </p>
        </header>
        <ReswellTrackingSection
          orderId={page.orderId}
          trackingNumber={page.trackingNumber}
          trackingCarrier={page.trackingCarrier}
          initialDetail={page.detail}
          marketplaceDeliveryStatus={page.deliveryStatus}
          variant="buyer"
          carrierTrackingFetchPath={`/api/orders/${encodeURIComponent(page.orderId)}/tracking-page`}
          sectionDescription="Live carrier scans for this Reswell shipment."
        />
      </div>
    </main>
  )
}
