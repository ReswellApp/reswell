"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react"
import { toast } from "sonner"
import {
  carrierTrackingIndicatesDelivered,
  trackingStatusLabel,
  trackingStatusTone,
} from "@/lib/shipping/carrier-status-display"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { formatCarrierDisplayName } from "@/lib/shipping/resolve-carrier-code"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LocalDateOnly, LocalDateTime } from "@/components/ui/local-datetime"

const POLL_MS = 30_000
const FETCH_TIMEOUT_MS = 35_000

type CarrierTrackingApiBody = {
  data?: OrderTrackingDetail
  live?: boolean
  fetchError?: string | null
  error?: string
  deliveryStatus?: string | null
  deliveryStatusUpdated?: boolean
}

function formatEventLocation(event: NonNullable<OrderTrackingDetail["events"]>[number]): string | null {
  const cityState = [event.city_locality, event.state_province].filter(Boolean).join(", ")
  const postal = event.postal_code?.trim()
  if (cityState && postal) return `${cityState} ${postal}`
  if (cityState) return cityState
  if (postal) return postal
  return null
}

function TrackingTimeline({ events }: { events: NonNullable<OrderTrackingDetail["events"]> }) {
  return (
    <ol className="relative space-y-0">
      {events.map((event, index) => {
        const isFirst = index === 0
        const isLast = index === events.length - 1
        const location = formatEventLocation(event)
        return (
          <li key={`${event.occurred_at ?? "event"}-${index}`} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast ? (
              <span
                className="absolute left-[7px] top-3 h-[calc(100%-4px)] w-px bg-border"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-[1] mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 bg-background",
                isFirst ? "border-primary bg-primary/15" : "border-muted-foreground/35",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1 pt-0.5">
              {event.occurred_at ? (
                <p className="text-xs tabular-nums text-muted-foreground">
                  <LocalDateTime iso={event.occurred_at} dateStyle="medium" timeStyle="short" />
                </p>
              ) : null}
              {event.description?.trim() ? (
                <p
                  className={cn(
                    "mt-1 text-sm leading-snug",
                    isFirst ? "font-medium text-foreground" : "text-foreground/90",
                  )}
                >
                  {event.description.trim()}
                </p>
              ) : null}
              {location ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  {location}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function marketplaceStatusIsTerminal(status: string): boolean {
  return status === "delivered" || status === "picked_up"
}

function shouldRefreshMarketplaceUi(
  marketplaceDeliveryStatus: string,
  body: CarrierTrackingApiBody,
): boolean {
  if (body.deliveryStatusUpdated) return true

  const nextStatus = body.deliveryStatus?.trim()
  if (nextStatus && nextStatus !== marketplaceDeliveryStatus) return true

  if (
    body.data &&
    carrierTrackingIndicatesDelivered(body.data) &&
    !marketplaceStatusIsTerminal(marketplaceDeliveryStatus)
  ) {
    return true
  }

  return false
}

export function ReswellTrackingSection(props: {
  orderId: string
  trackingNumber: string
  trackingCarrier: string | null
  initialDetail?: OrderTrackingDetail | null
  marketplaceDeliveryStatus: string
  variant?: "buyer" | "seller"
  className?: string
  /** Defaults to `/api/orders/:id/carrier-tracking` (buyer/seller). Pass admin path for staff views. */
  carrierTrackingFetchPath?: string
}) {
  const {
    orderId,
    trackingNumber,
    trackingCarrier,
    initialDetail,
    marketplaceDeliveryStatus,
    variant = "buyer",
    className,
    carrierTrackingFetchPath,
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
  const refreshScheduledRef = useRef(false)

  const carrierLabel = useMemo(
    () => formatCarrierDisplayName(trackingCarrier, null),
    [trackingCarrier],
  )

  const scheduleMarketplaceRefresh = useCallback(() => {
    if (refreshScheduledRef.current) return
    refreshScheduledRef.current = true
    router.refresh()
    window.setTimeout(() => {
      refreshScheduledRef.current = false
    }, 2_000)
  }, [router])

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
        const body = (await res.json()) as CarrierTrackingApiBody
        if (!res.ok) {
          setFetchError(body.error ?? "Could not load tracking")
          return
        }
        if (body.data) {
          setDetail(body.data)
        }
        setLive(body.live ?? false)
        setFetchError(body.fetchError ?? null)

        if (shouldRefreshMarketplaceUi(marketplaceStatusRef.current, body)) {
          scheduleMarketplaceRefresh()
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
    [carrierTrackingFetchPath, orderId, scheduleMarketplaceRefresh],
  )

  useEffect(() => {
    setDetail(initialDetail ?? null)
  }, [initialDetail])

  useEffect(() => {
    void loadTracking()
  }, [loadTracking])

  useEffect(() => {
    if (marketplaceStatusIsTerminal(marketplaceDeliveryStatus)) return

    const id = window.setInterval(() => {
      void loadTracking({ silent: true })
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [loadTracking, marketplaceDeliveryStatus])

  useEffect(() => {
    if (marketplaceStatusIsTerminal(marketplaceDeliveryStatus)) return

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadTracking({ silent: true })
      }
    }
    const onFocus = () => {
      void loadTracking({ silent: true })
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
    }
  }, [loadTracking, marketplaceDeliveryStatus])

  const headline = detail ? trackingStatusLabel(detail) : "Loading carrier updates…"
  const sub = detail?.carrier_status_description?.trim()
  const tone = trackingStatusTone(detail?.status_code)
  const showCarrierDeliveredNote =
    detail != null &&
    carrierTrackingIndicatesDelivered(detail) &&
    !marketplaceStatusIsTerminal(marketplaceDeliveryStatus)
  const events = detail?.events ?? []

  const copyTracking = async () => {
    try {
      await navigator.clipboard.writeText(trackingNumber.trim())
      toast.success("Tracking number copied")
    } catch {
      toast.error("Could not copy tracking number")
    }
  }

  return (
    <Card className={cn("overflow-hidden border-primary/20", className)}>
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Reswell tracking</CardTitle>
              <CardDescription className="text-[13px] leading-snug">
                Live carrier scans for your shipment.
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
                    truth — your payout releases automatically 24 hours after delivery.
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
                      {events.length} {events.length === 1 ? "event" : "events"} · scroll to see all
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
                <div className="relative rounded-lg border border-border/70 bg-muted/10">
                  <div
                    className="max-h-[min(22rem,52vh)] overflow-y-auto overscroll-y-contain px-3 py-3 sm:max-h-96"
                    aria-label="Shipment activity timeline"
                    tabIndex={0}
                  >
                    <TrackingTimeline events={events} />
                  </div>
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-lg bg-gradient-to-t from-muted/30 to-transparent"
                    aria-hidden
                  />
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
          <p className="text-[11px] text-muted-foreground">Updates automatically while in transit.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
