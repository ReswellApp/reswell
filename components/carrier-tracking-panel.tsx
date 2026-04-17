"use client"

import { Package } from "lucide-react"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LocalDateOnly, LocalDateTime } from "@/components/ui/local-datetime"

export function CarrierTrackingPanel(props: {
  detail: OrderTrackingDetail
  /** App delivery state — carrier "delivered" does not complete the Reswell order. */
  marketplaceDeliveryStatus: string
  variant?: "buyer" | "seller"
}) {
  const { detail, marketplaceDeliveryStatus, variant = "buyer" } = props
  const headline =
    detail.status_description?.trim() ||
    detail.carrier_status_description?.trim() ||
    "Tracking update"
  const sub = detail.carrier_status_description?.trim()
  const showCarrierDeliveredNote =
    detail.status_code === "DE" && marketplaceDeliveryStatus === "shipped"

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Package className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Carrier tracking</CardTitle>
            <CardDescription className="text-[13px] leading-snug">
              Updates from the shipping carrier (via ShipEngine).{" "}
              {marketplaceDeliveryStatus !== "delivered" ? (
                variant === "seller" ? (
                  <>
                    The buyer still confirms delivery on Reswell to complete the order and release your payout.
                  </>
                ) : (
                  <>
                    When your board arrives, use <span className="font-medium text-foreground">Confirm delivery</span>{" "}
                    on Reswell to finish the order.
                  </>
                )
              ) : null}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div>
          <p className="font-medium text-foreground leading-snug">{headline}</p>
          {sub && sub !== headline ? (
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{sub}</p>
          ) : null}
        </div>

        {detail.exception_description?.trim() ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            {detail.exception_description.trim()}
          </p>
        ) : null}

        {showCarrierDeliveredNote ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-border/80 bg-muted/30 px-3 py-2 leading-relaxed">
            {variant === "seller" ? (
              <>
                The carrier may show delivered. The buyer still confirms on Reswell before the order completes and your
                payout releases.
              </>
            ) : (
              <>
                The carrier may show this shipment as delivered. On Reswell, your order stays open until you confirm —
                so you can inspect your board first.
              </>
            )}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {detail.estimated_delivery_date ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Est. delivery</p>
              <p className="text-foreground mt-0.5">
                <LocalDateOnly iso={detail.estimated_delivery_date} dateStyle="medium" />
              </p>
            </div>
          ) : null}
          {detail.actual_delivery_date ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Carrier delivered
              </p>
              <p className="text-foreground mt-0.5">
                <LocalDateTime iso={detail.actual_delivery_date} dateStyle="medium" timeStyle="short" />
              </p>
            </div>
          ) : null}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Last update</p>
            <p className="text-foreground mt-0.5">
              <LocalDateTime iso={detail.updated_at} dateStyle="medium" timeStyle="short" />
            </p>
          </div>
        </div>

        {detail.events && detail.events.length > 0 ? (
          <div className="border-t pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Recent scans
            </p>
            <ul className="space-y-3">
              {detail.events.map((ev, i) => {
                const loc = [ev.city_locality, ev.state_province].filter(Boolean).join(", ")
                const when = ev.occurred_at
                return (
                  <li key={`${ev.occurred_at ?? i}-${i}`} className="text-sm">
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 justify-between">
                      {when ? (
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          <LocalDateTime iso={when} dateStyle="medium" timeStyle="short" />
                        </span>
                      ) : null}
                    </div>
                    {ev.description?.trim() ? (
                      <p className="text-foreground mt-1 leading-snug">{ev.description.trim()}</p>
                    ) : null}
                    {loc ? <p className="text-xs text-muted-foreground mt-0.5">{loc}</p> : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
