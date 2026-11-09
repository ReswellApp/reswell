"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react"
import { toast } from "sonner"
import { carrierTrackingIndicatesDelivered } from "@/lib/shipping/carrier-status-display"
import {
  trackingStatusLabel,
  trackingStatusTone,
} from "@/lib/shipping/carrier-status-display"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { formatCarrierDisplayName } from "@/lib/shipping/resolve-carrier-code"
import { trackingMapPointsFromEvents, trackingMapSummary } from "@/lib/shipping/tracking-map-points"
import { cn } from "@/lib/utils"
import { TrackingRouteMap } from "@/components/features/orders/tracking-route-map"
import { TrackingTimeline } from "@/components/features/orders/tracking-timeline"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LocalDateOnly, LocalDateTime } from "@/components/ui/local-datetime"

const POLL_MS = 45_000
const FETCH_TIMEOUT_MS = 35_000

export function ReswellTrackingSection(props: {
  orderId: string
  trackingNumber: string
  trackingCarrier: string | null
  initialDetail?: OrderTrackingDetail | null
  marketplaceDeliveryStatus: string
  variant?: "buyer" | "seller"
  className?: string
  /** Keep live carrier polling without rendering the tracking card. */
  pollOnly?: boolean
  /** Defaults to `/api/orders/:id/carrier-tracking` (buyer/seller). Pass admin path for staff views. */
  carrierTrackingFetchPath?: string
  /** On-site Reswell tracker (`/track/{orderId}`). */
  trackUrl?: string | null
  sectionTitle?: string
  sectionDescription?: string
}) {
  const {
    orderId,
    trackingNumber,
    trackingCarrier,
    initialDetail,
    marketplaceDeliveryStatus,
    variant = "buyer",
    className,
    pollOnly = false,
    carrierTrackingFetchPath,
    trackUrl,
    sectionTitle = "Reswell tracking",
    sectionDescription = "Live carrier scans for your shipment.",
  } = props

  const router = useRouter()
  const [detail, setDetail] = useState<OrderTrackingDetail | null>(initialDetail ?? null)
  const [loading, setLoading] = useState(!initialDetail)
  const [refreshing, setRefreshing] = useState(false)
  const [live, setLive] = useState<boolean | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const detailRef = useRef(detail)
  detailRef.current = detail
  const marketplaceStatusRef = useRef(marketplaceDeliveryStatus)
  marketplaceStatusRef.current = marketplaceDeliveryStatus

  const carrierLabel = useMemo(
    () => formatCarrierDisplayName(trackingCarrier, null),
    [trackingCarrier],
  )

  const loadTracking = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        if (detailRef.current) setRefreshing(true)
        else setLoading(true)
      }

      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      try {
        const fetchPath =
          carrierTrackingFetchPath ??
          `/api/orders/${encodeURIComponent(orderId)}/carrier-tracking`
        const res = await fetch(fetchPath, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        })
        const body = (await res.json()) as {
          data?: OrderTrackingDetail
          live?: boolean
          fetchError?: string | null
          error?: string
          marketplace?: {
            delivery_status: string | null
            carrier_delivered_at: string | null
          } | null
        }
        if (!res.ok) {
          setFetchError(body.error ?? "Could not load tracking")
          return
        }
        if (body.data) {
          setDetail(body.data)
        }
        setLive(body.live ?? false)
        setFetchError(body.fetchError ?? null)

        // Refresh server props when carrier delivery lands so pending earnings
        // and marketplace status update without waiting for a full page reload.
        const syncedStatus = body.marketplace?.delivery_status
        const prevStatus = marketplaceStatusRef.current
        const carrierSaysDelivered =
          (body.data && carrierTrackingIndicatesDelivered(body.data)) ||
          syncedStatus === "delivered"
        if (
          carrierSaysDelivered &&
          prevStatus !== "delivered" &&
          prevStatus !== "picked_up"
        ) {
          router.refresh()
        } else if (
          body.marketplace?.carrier_delivered_at &&
          syncedStatus &&
          syncedStatus !== prevStatus
        ) {
          router.refresh()
        }
      } catch (err) {
        const timedOut =
          err instanceof DOMException
            ? err.name === "AbortError"
            : err instanceof Error && err.name === "AbortError"
        setFetchError(
          timedOut
            ? "Tracking request timed out — try Refresh in a moment."
            : "Could not load tracking",
        )
      } finally {
        window.clearTimeout(timer)
        setLoading(false)
        setRefreshing(false)
      }
    },
    [carrierTrackingFetchPath, orderId, router],
  )

  const marketplaceTerminal =
    marketplaceDeliveryStatus === "delivered" || marketplaceDeliveryStatus === "picked_up"
  const skipLiveFetchOnMount = marketplaceTerminal && (pollOnly || Boolean(initialDetail))

  useEffect(() => {
    // A finished shipment already has its scans. Skip the carrier call on open;
    // in-transit orders still load live scans.
    if (skipLiveFetchOnMount) return
    void loadTracking()
  }, [loadTracking, skipLiveFetchOnMount])

  useEffect(() => {
    if (marketplaceDeliveryStatus === "delivered" || marketplaceDeliveryStatus === "picked_up") return

    const id = window.setInterval(() => {
      void loadTracking({ silent: true })
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [loadTracking, marketplaceDeliveryStatus])

  const headline = detail ? trackingStatusLabel(detail) : "Loading carrier updates…"
  const sub = detail?.carrier_status_description?.trim()
  const tone = trackingStatusTone(detail?.status_code)
  const showCarrierDeliveredNote =
    detail?.status_code === "DE" &&
    marketplaceDeliveryStatus !== "delivered" &&
    marketplaceDeliveryStatus !== "picked_up"
  const events = detail?.events ?? []
  const mapPoints = trackingMapPointsFromEvents(events)
  const mapSummary = trackingMapSummary(mapPoints)

  const copyTracking = async () => {
    try {
      await navigator.clipboard.writeText(trackingNumber.trim())
      toast.success("Tracking number copied")
    } catch {
      toast.error("Could not copy tracking number")
    }
  }

  if (pollOnly) return null

  return (
    <Card className={cn("overflow-hidden border-primary/20", className)}>
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">{sectionTitle}</CardTitle>
              <CardDescription className="text-[13px] leading-snug">
                {sectionDescription}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {carrierLabel}
            </Badge>
            {detail ? (
              <Badge
                variant={tone === "success" ? "default" : tone === "warning" ? "destructive" : "secondary"}
                className={cn(
                  tone === "success" && "bg-emerald-600 hover:bg-emerald-600",
                  tone === "warning" && "bg-amber-600 hover:bg-amber-600",
                )}
              >
                {headline}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <div className="rounded-lg border border-border/80 bg-background px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tracking number
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-medium text-foreground break-all">{trackingNumber.trim()}</p>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyTracking}>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Copy tracking number</span>
            </Button>
            {trackUrl ? (
              <Button variant="outline" size="sm" className="h-8" asChild>
                <a href={trackUrl} target="_blank" rel="noopener noreferrer">
                  Track package
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        {loading && !detail ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Fetching live carrier events…
          </div>
        ) : null}

        {detail ? (
          <>
            <div className="space-y-1">
              <p className="font-medium text-foreground leading-snug">{headline}</p>
              {sub && sub !== headline ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{sub}</p>
              ) : null}
            </div>

            {detail.exception_description?.trim() ? (
              <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                {detail.exception_description.trim()}
              </p>
            ) : null}

            {showCarrierDeliveredNote ? (
              <p className="flex gap-2 text-xs text-muted-foreground rounded-lg border border-border/80 bg-muted/30 px-3 py-2 leading-relaxed">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden />
                {variant === "seller" ? (
                  <>
                    The carrier reports this shipment as delivered. Reswell uses carrier tracking as the source of
                    truth — your payout releases automatically 4 days after delivery.
                  </>
                ) : (
                  <>
                    The carrier reports this shipment as delivered. Reswell marks your order complete from carrier
                    tracking — no separate confirmation needed.
                  </>
                )}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              {detail.estimated_delivery_date ? (
                <div className="rounded-lg border border-border/70 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Est. delivery
                  </p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    <LocalDateOnly iso={detail.estimated_delivery_date} dateStyle="medium" />
                  </p>
                </div>
              ) : null}
              {detail.actual_delivery_date ? (
                <div className="rounded-lg border border-border/70 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Carrier delivered
                  </p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    <LocalDateTime iso={detail.actual_delivery_date} dateStyle="medium" timeStyle="short" />
                  </p>
                </div>
              ) : null}
              <div className="rounded-lg border border-border/70 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Last refreshed
                </p>
                <p className="text-sm font-medium text-foreground mt-1">
                  <LocalDateTime iso={detail.updated_at} dateStyle="medium" timeStyle="short" />
                </p>
              </div>
            </div>

            {events.length > 0 ? (
              <div className="border-t pt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                      Shipment activity
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {mapSummary ??
                        `${events.length} ${events.length === 1 ? "scan" : "scans"}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 text-xs"
                    disabled={refreshing}
                    onClick={() => void loadTracking()}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
                    Refresh
                  </Button>
                </div>
                {mapPoints.length > 0 ? <TrackingRouteMap points={mapPoints} className="mb-4" /> : null}
                <div className="rounded-lg border border-border/70 bg-muted/10 px-3 py-3">
                  <TrackingTimeline events={events} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground border-t pt-4">
                No scan events yet. The carrier may not have posted updates — check back shortly.
              </p>
            )}
          </>
        ) : null}

        {!loading && !detail ? (
          <p className="text-sm text-muted-foreground">
            {fetchError ?? "Tracking events are not available yet."}
          </p>
        ) : null}

        {fetchError && detail ? (
          <p className="text-xs text-muted-foreground">
            Showing last saved update. Live refresh failed: {fetchError}
          </p>
        ) : null}

        {live === true ? (
          <p className="text-[11px] text-muted-foreground">Updates automatically every few minutes while in transit.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
