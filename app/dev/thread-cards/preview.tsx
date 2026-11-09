"use client"

import { OfferNegotiationEventCard } from "@/components/features/messages/offer-negotiation-event-card"
import { OrderCompletedMessageCard } from "@/components/features/messages/order-completed-message-card"
import { OrderPlacedMessageCard } from "@/components/features/messages/order-placed-message-card"
import { OrderRefundedMessageCard } from "@/components/features/messages/order-refunded-message-card"
import { OrderShippedMessageCard } from "@/components/features/messages/order-shipped-message-card"
import { ShippingLabelMessageCard } from "@/components/features/messages/shipping-label-message-card"

const NOW = "2026-10-26T18:22:00.000Z"
const LATER = "2026-10-26T18:43:00.000Z"
const ORDER_ID = "00000000-0000-4000-8000-000000000001"
const TITLE = "Step driver lost surfboard Shortboard 6'2"

export function ThreadCardsPreview() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-[24rem] space-y-8">
        <section>
          <h1 className="mb-3 text-sm font-semibold text-muted-foreground">
            Screenshot flow — seller thread
          </h1>
          <div className="rounded-[22px] border border-border/50 bg-muted/40 px-3 py-4">
            <div className="flex justify-start">
              <OfferNegotiationEventCard
                kind="accepted"
                content="Offer accepted — $500.00."
                createdAt={NOW}
                isOwn
                offerHref="/dashboard/offers"
              />
            </div>
            <div className="flex justify-center py-3">
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground/70">
                Oct 26, 11:43 AM
              </span>
            </div>
            <div className="flex justify-start">
              <OrderPlacedMessageCard
                payload={{
                  kind: "order_placed",
                  orderId: ORDER_ID,
                  orderNum: "WH8FNX",
                  listingTitle: TITLE,
                  total: 450,
                  fulfillment: "pickup",
                  paymentMethod: "card",
                }}
                createdAt={LATER}
                viewerIsSeller
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Buyer checkout + shipping</h2>
          <OfferNegotiationEventCard
            kind="accepted"
            content="Offer accepted — $500.00."
            createdAt={NOW}
            isOwn={false}
            offerHref="/dashboard/offers"
            checkoutOfferId={ORDER_ID}
          />
          <OrderPlacedMessageCard
            payload={{
              kind: "order_placed",
              orderId: ORDER_ID,
              orderNum: "WH8FNX",
              listingTitle: TITLE,
              total: 450,
              fulfillment: "shipping",
              paymentMethod: "card",
            }}
            createdAt={LATER}
            viewerIsSeller={false}
          />
          <ShippingLabelMessageCard
            payload={{
              source: "reswell",
              orderId: ORDER_ID,
              orderNum: "WH8FNX",
              listingTitle: TITLE,
              trackingNumber: "9400111899223197428492",
              trackingCarrier: "usps",
              trackingUrl: "https://example.com",
              labelPdfUrl: "https://example.com/label.pdf",
              hasPaperlessQr: false,
            }}
            createdAt={LATER}
            viewerRole="seller"
          />
          <OrderShippedMessageCard
            payload={{
              orderId: ORDER_ID,
              orderNum: "WH8FNX",
              listingTitle: TITLE,
              trackingNumber: "9400111899223197428492",
              trackingCarrier: "usps",
              trackingUrl: "https://example.com",
            }}
            createdAt={LATER}
            viewerRole="buyer"
          />
          <OrderCompletedMessageCard
            payload={{
              kind: "order_completed",
              orderId: ORDER_ID,
              orderNum: "WH8FNX",
              listingTitle: TITLE,
            }}
            createdAt={LATER}
            viewerIsSeller
          />
          <OrderRefundedMessageCard
            payload={{
              kind: "order_refunded",
              orderId: ORDER_ID,
              orderNum: "WH8FNX",
              listingTitle: TITLE,
            }}
            createdAt={LATER}
            viewerIsSeller={false}
          />
        </section>
      </div>
    </main>
  )
}
