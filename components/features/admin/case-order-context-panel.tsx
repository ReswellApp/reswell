"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import {
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Store,
  Truck,
  User,
} from "lucide-react"
import type { AdminOrderDetail, AdminOrderParticipant } from "@/lib/db/adminOrders"
import {
  caseOrderLabelContextFromCapabilities,
  type AdminOrderCapabilities,
  type CaseOrderLabelContext,
} from "@/lib/admin/admin-order-capabilities"
import { AdminShippingLabelPreviewButton } from "@/components/features/admin/admin-shipping-label-preview-button"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  deliveryStatusBadgeVariant,
  deliveryStatusLabel,
  orderStatusBadgeVariant,
  orderStatusLabel,
} from "@/lib/order-status"
import { AdminOrderMarketplaceMessagesPanel } from "@/components/features/admin/admin-order-marketplace-messages-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VerifiedBadge } from "@/components/verified-badge"
import { cn } from "@/lib/utils"

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

function participantName(p: AdminOrderParticipant): string {
  if (p.is_shop && p.shop_name?.trim()) return p.shop_name.trim()
  if (p.display_name?.trim()) return p.display_name.trim()
  if (p.email?.trim()) return p.email.trim()
  if (p.id === "guest") return "Guest buyer"
  return `${p.id.slice(0, 8)}…`
}

function PartyBlock({
  role,
  participant,
}: {
  role: "Buyer" | "Seller"
  participant: AdminOrderParticipant
}) {
  const name = participantName(participant)
  const location = [participant.city, participant.state].filter(Boolean).join(", ")
  const isGuest = participant.id === "guest"

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {role}
      </p>
      <div className="flex items-start gap-2.5">
        {participant.avatar_url ? (
          <Image
            src={participant.avatar_url}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {role === "Seller" ? (
              <Store className="h-4 w-4" aria-hidden />
            ) : (
              <User className="h-4 w-4" aria-hidden />
            )}
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            {role === "Seller" && participant.shop_verified ? <VerifiedBadge /> : null}
          </div>
          {participant.display_name?.trim() &&
          participant.is_shop &&
          participant.shop_name?.trim() &&
          participant.display_name.trim() !== participant.shop_name.trim() ? (
            <p className="truncate text-xs text-muted-foreground">
              Profile: {participant.display_name}
            </p>
          ) : null}
          {participant.email ? (
            <p className="truncate text-xs text-muted-foreground">{participant.email}</p>
          ) : null}
          {location ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              {location}
            </p>
          ) : null}
          {role === "Seller" && participant.sales_count != null ? (
            <p className="text-xs text-muted-foreground">{participant.sales_count} sales</p>
          ) : null}
          {participant.created_at ? (
            <p className="text-xs text-muted-foreground">
              Member since {format(new Date(participant.created_at), "MMM yyyy")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {!isGuest ? (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
            <Link href={`/admin/users/${participant.id}`}>
              <ExternalLink className="mr-1 h-3 w-3" aria-hidden />
              Admin profile
            </Link>
          </Button>
        ) : null}
        {role === "Seller" && participant.seller_slug ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
            <Link href={`/sellers/${participant.seller_slug}`} target="_blank">
              Public shop
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

interface CaseOrderContextPanelProps {
  orderId: string
  orderSupportRequestId?: string | null
  className?: string
  onLoaded?: (detail: AdminOrderDetail, extras: CaseOrderLabelContext) => void
}

export function CaseOrderContextPanel({
  orderId,
  orderSupportRequestId = null,
  className,
  onLoaded,
}: CaseOrderContextPanelProps) {
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [extras, setExtras] = useState<CaseOrderLabelContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [threadOpen, setThreadOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)
    setExtras(null)
    setThreadOpen(false)

    void (async () => {
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
          credentials: "include",
        })
        const json = (await res.json()) as {
          data?: AdminOrderDetail
          capabilities?: Partial<AdminOrderCapabilities>
          error?: string
        }
        if (cancelled) return
        if (!res.ok || !json.data) {
          setError(json.error ?? "Could not load order")
          setLoading(false)
          return
        }
        const labelContext = caseOrderLabelContextFromCapabilities(json.capabilities)
        setDetail(json.data)
        setExtras(labelContext)
        onLoaded?.(json.data, labelContext)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError("Could not load order")
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [orderId, onLoaded])

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading order context…
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground",
          className,
        )}
      >
        {error ?? "Order details unavailable."}{" "}
        <Link href={`/admin/orders/${orderId}`} className="underline underline-offset-2">
          Open order
        </Link>
      </div>
    )
  }

  const orderLabel = formatOrderNumForCustomer(detail.order_num, detail.id)
  const lineTitles =
    detail.order_items.length > 0
      ? detail.order_items.map((i) => i.title?.trim() || "Untitled").join(", ")
      : detail.listing_title?.trim() || "Untitled listing"
  const shipTo = detail.shipping_address
  const shipToLine = shipTo
    ? [
        shipTo.name,
        [shipTo.address?.line1, shipTo.address?.line2].filter(Boolean).join(" "),
        [shipTo.address?.city, shipTo.address?.state, shipTo.address?.postal_code]
          .filter(Boolean)
          .join(", "),
      ]
        .filter((p) => p && String(p).trim())
        .join(" · ")
    : null

  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Order context
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{orderLabel}</p>
            <Badge variant={orderStatusBadgeVariant(detail.status)}>
              {orderStatusLabel(detail.status)}
            </Badge>
            {detail.delivery_status ? (
              <Badge variant={deliveryStatusBadgeVariant(detail.delivery_status)}>
                {deliveryStatusLabel(detail.delivery_status)}
              </Badge>
            ) : null}
            {detail.is_reswell_shop ? (
              <Badge variant="outline">Reswell shop</Badge>
            ) : null}
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-8" asChild>
          <Link href={`/admin/orders/${detail.id}`}>
            <Package className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Full order
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">{lineTitles}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {money(detail.item_price)} item
          {detail.shipping_amount > 0 ? ` · ${money(detail.shipping_amount)} shipping` : ""}
          {" · "}
          <span className="font-medium text-foreground">{money(detail.amount)} total</span>
          {detail.payment_method ? ` · ${detail.payment_method}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Placed{" "}
          {formatDistanceToNow(new Date(detail.created_at), { addSuffix: true })}
          {" · "}
          {format(new Date(detail.created_at), "MMM d, yyyy")}
          {detail.fulfillment_method
            ? ` · ${detail.fulfillment_method === "local_pickup" ? "Local pickup" : "Shipping"}`
            : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PartyBlock role="Buyer" participant={detail.buyer} />
        <PartyBlock role="Seller" participant={detail.seller} />
      </div>

      <div className="space-y-1.5 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <p className="flex items-start gap-1.5">
          <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {detail.tracking_carrier || "Carrier"} ·{" "}
            {detail.tracking_number || "No tracking yet"}
            {detail.carrier_delivered_at
              ? ` · delivered ${format(new Date(detail.carrier_delivered_at), "MMM d, yyyy")}`
              : detail.delivery_status === "delivered"
                ? " · delivered (date not on file)"
                : ""}
          </span>
        </p>
        {extras?.shipFromOnFile ? (
          <p>
            Ship from (on file): {extras.shipFromOnFile.name} · {extras.shipFromOnFile.oneLine}
          </p>
        ) : null}
        {[detail.listing_city, detail.listing_state].filter(Boolean).length > 0 ? (
          <p>
            Listing location: {[detail.listing_city, detail.listing_state].filter(Boolean).join(", ")}
          </p>
        ) : null}
        {shipToLine ? <p>Ship to: {shipToLine}</p> : null}
        {extras?.hasShippingLabel ? (
          <AdminShippingLabelPreviewButton orderId={detail.id} className="pt-1" />
        ) : detail.fulfillment_method === "shipping" ? (
          <p>No shipping label on file for this order.</p>
        ) : null}
        {detail.pickup_code ? <p>Pickup code: {detail.pickup_code}</p> : null}
        {detail.payout ? (
          <p>
            Seller payout: {detail.payout.status}
            {detail.payout.hold_reason ? ` (${detail.payout.hold_reason})` : ""}
          </p>
        ) : null}
        {detail.conversation_id ? (
          <div className="space-y-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant={threadOpen ? "secondary" : "outline"}
              className="h-8"
              onClick={() => setThreadOpen((o) => !o)}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {threadOpen ? "Hide" : "View"} buyer ↔ seller thread (
              {detail.marketplace_message_count} msgs)
            </Button>
            {threadOpen ? (
              <div className="rounded-lg border border-border/60 bg-background p-3">
                <AdminOrderMarketplaceMessagesPanel
                  embedded
                  conversationId={detail.conversation_id}
                  messageCount={detail.marketplace_message_count}
                  buyerId={detail.buyer_id ?? detail.buyer.id}
                  sellerId={detail.seller_id}
                  buyerName={participantName(detail.buyer)}
                  sellerName={participantName(detail.seller)}
                  orderSupportRequestId={orderSupportRequestId}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <p>No buyer ↔ seller marketplace thread for this order yet.</p>
        )}
      </div>
    </div>
  )
}

export function adminOrderParticipantDisplayName(p: AdminOrderParticipant): string {
  return participantName(p)
}
