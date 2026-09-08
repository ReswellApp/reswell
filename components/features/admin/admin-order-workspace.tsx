"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { ArrowLeft, Copy, Loader2, Store } from "lucide-react"
import { toast } from "sonner"
import { AdminOrderFulfillmentSection } from "@/components/features/admin/admin-order-fulfillment-section"
import { AdminOrderMarketplaceMessagesPanel } from "@/components/features/admin/admin-order-marketplace-messages-panel"
import { AdminOrderMoneySection } from "@/components/features/admin/admin-order-money-section"
import { AdminOrderParticipantCard } from "@/components/features/admin/admin-order-participant-card"
import { AdminOrderSupportSection, type AdminOrderSupportRequest } from "@/components/features/admin/admin-order-support-section"
import {
  AdminOrderSituationChip,
  adminOrderSituationSurfaceClass,
} from "@/components/features/admin/admin-order-situation-chip"
import { AdminReswellShopFulfillForm } from "@/components/features/admin/admin-reswell-shop-fulfill-form"
import { OrderDetailRealtimeRefresh } from "@/components/order-realtime-refresh"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { adminOrderSituation } from "@/lib/admin-order-situation"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type OrderApiResponse =
  | {
      data: AdminOrderDetail
      capabilities: {
        canRefund: boolean
        canReleaseShippingSellerEarnings: boolean
        hasShippingLabel: boolean
        hasPaperlessQr: boolean
        paperlessInstructions: string | null
        paperlessHandoffCode: string | null
        canFulfillReswellShop: boolean
        canReplaceShippingLabel: boolean
      }
    }
  | { error: string }

function participantLabel(participant: AdminOrderDetail["buyer"], fallback: string): string {
  if (participant.is_shop && participant.shop_name?.trim()) return participant.shop_name.trim()
  if (participant.display_name?.trim()) return participant.display_name.trim()
  if (participant.email?.trim()) return participant.email.trim()
  return fallback
}

export function AdminOrderWorkspace() {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : ""
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<OrderApiResponse | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)
  const [supportRequests, setSupportRequests] = useState<AdminOrderSupportRequest[]>([])
  const [releaseBusy, setReleaseBusy] = useState(false)
  const bumpRefetch = useCallback(() => {
    setRefetchKey((k) => k + 1)
  }, [])

  const fetchOrder = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`)
      const body = (await res.json()) as OrderApiResponse & { error?: string }
      if (!res.ok && "error" in body) {
        setPayload({ error: body.error ?? "Could not load order" })
      } else if ("data" in body && body.data && "capabilities" in body && body.capabilities) {
        setPayload({
          data: body.data,
          capabilities: {
            canRefund: body.capabilities.canRefund === true,
            canReleaseShippingSellerEarnings: body.capabilities.canReleaseShippingSellerEarnings === true,
            hasShippingLabel: body.capabilities.hasShippingLabel === true,
            hasPaperlessQr: body.capabilities.hasPaperlessQr === true,
            paperlessInstructions:
              typeof body.capabilities.paperlessInstructions === "string"
                ? body.capabilities.paperlessInstructions
                : null,
            paperlessHandoffCode:
              typeof body.capabilities.paperlessHandoffCode === "string"
                ? body.capabilities.paperlessHandoffCode
                : null,
            canFulfillReswellShop: body.capabilities.canFulfillReswellShop === true,
            canReplaceShippingLabel: body.capabilities.canReplaceShippingLabel === true,
          },
        })
      } else {
        setPayload({ error: "Unexpected response" })
      }
    } catch {
      setPayload({ error: "Could not load order" })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchOrder()
  }, [fetchOrder, refetchKey])

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    supabase
      .from("order_support_requests")
      .select("id, request_type, body, contacted_seller_first, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setSupportRequests(data as AdminOrderSupportRequest[])
      })
  }, [id])

  if (!id) {
    return (
      <p className="text-muted-foreground">
        Missing order id. Browse{" "}
        <Link href="/admin/orders" className="underline">
          All orders
        </Link>
        .
      </p>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading order…
      </div>
    )
  }

  if (!payload || "error" in payload) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/admin/orders">
            <ArrowLeft className="h-4 w-4" />
            All orders
          </Link>
        </Button>
        <p className="text-destructive">{payload && "error" in payload ? payload.error : "Not found"}</p>
      </div>
    )
  }

  const o = payload.data
  const caps = payload.capabilities
  const showLegacyManualPayoutRelease =
    caps.canReleaseShippingSellerEarnings &&
    o.payout?.status === "held" &&
    o.payout.hold_reason !== "awaiting_carrier_settlement" &&
    (o.payout.hold_reason === "awaiting_manual_release" ||
      (o.delivery_status === "delivered" && !o.carrier_delivered_at))
  const displayNum = formatOrderNumForCustomer(o.order_num, o.id)
  const buyerName = participantLabel(o.buyer, "Buyer")
  const sellerName = participantLabel(o.seller, "Seller")
  const situation = adminOrderSituation({
    status: o.status,
    fulfillment_method: o.fulfillment_method,
    delivery_status: o.delivery_status,
    tracking_number: o.tracking_number,
    tracking_carrier: o.tracking_carrier,
    pickup_code: o.pickup_code,
    is_reswell_shop: o.is_reswell_shop,
    canFulfillReswellShop: caps.canFulfillReswellShop,
    payout: o.payout,
    has_prepared_label: caps.hasShippingLabel,
  })

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error("Could not copy")
    }
  }

  async function releaseShippingSellerEarnings() {
    if (!id) return
    setReleaseBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/release-shipping-seller-earnings`, {
        method: "POST",
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof body.error === "string" ? body.error : "Could not release earnings")
        return
      }
      toast.success("Payout approved — seller earnings are now available per your rules.")
      bumpRefetch()
    } catch {
      toast.error("Could not release earnings")
    } finally {
      setReleaseBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <OrderDetailRealtimeRefresh orderId={id} onUpdate={bumpRefetch} />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href={o.is_reswell_shop ? "/admin/shop/orders" : "/admin/orders"}>
            <ArrowLeft className="h-4 w-4" />
            {o.is_reswell_shop ? "Shop orders" : "All orders"}
          </Link>
        </Button>
        {o.is_reswell_shop ? (
          <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground">
            <Link href="/admin/orders">All marketplace orders</Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Order {displayNum}</h1>
            <Badge variant={orderStatusBadgeVariant(o.status)}>{orderStatusLabel(o.status)}</Badge>
            {o.is_reswell_shop ? (
              <Badge variant="outline" className="gap-1 border-foreground/20 bg-foreground/[0.04]">
                <Store className="h-3 w-3" aria-hidden />
                Reswell shop
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(o.created_at), "MMM d, yyyy HH:mm")}
            {o.listing_title ? ` · ${o.listing_title}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-muted-foreground">{o.id}</p>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => void copy(o.id, "Order ID")}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy ID
            </Button>
            {o.order_num ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => void copy(o.order_num as string, "Order #")}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy #
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">${o.amount.toFixed(2)}</p>
      </div>

      <div className={cn("rounded-xl border px-4 py-3", adminOrderSituationSurfaceClass(situation.tone))}>
        <div className="flex flex-wrap items-start gap-2">
          <AdminOrderSituationChip label={situation.label} tone={situation.tone} />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">{situation.nextStep}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{situation.detail}</p>
          </div>
        </div>
      </div>

      {caps.canFulfillReswellShop ? (
        <AdminReswellShopFulfillForm orderId={o.id} onFulfilled={bumpRefetch} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <AdminOrderFulfillmentSection
          order={o}
          canRefund={caps.canRefund}
          hasShippingLabel={caps.hasShippingLabel}
          hasPaperlessQr={caps.hasPaperlessQr}
          paperlessInstructions={caps.paperlessInstructions}
          paperlessHandoffCode={caps.paperlessHandoffCode}
          canReplaceShippingLabel={caps.canReplaceShippingLabel}
          onComplete={bumpRefetch}
        />
        <AdminOrderMoneySection
          order={o}
          canRefund={caps.canRefund}
          canReleaseShippingSellerEarnings={caps.canReleaseShippingSellerEarnings}
          showLegacyManualPayoutRelease={showLegacyManualPayoutRelease}
          releaseBusy={releaseBusy}
          onReleasePayout={() => void releaseShippingSellerEarnings()}
          onComplete={bumpRefetch}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminOrderParticipantCard role="Buyer" participant={o.buyer} />
        <AdminOrderParticipantCard role="Seller" participant={o.seller} />
      </div>

      <AdminOrderMarketplaceMessagesPanel
        conversationId={o.conversation_id}
        messageCount={o.marketplace_message_count}
        buyerId={o.buyer_id ?? ""}
        sellerId={o.seller_id}
        buyerName={buyerName}
        sellerName={sellerName}
      />

      <AdminOrderSupportSection requests={supportRequests} />
    </div>
  )
}
