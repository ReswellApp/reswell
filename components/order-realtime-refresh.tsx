"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

type OrderRefreshSnapshot = {
  delivery_status: string | null
  status: string | null
  tracking_number: string | null
  carrier_delivered_at: string | null
  refunded_at: string | null
}

function snapshotFromRow(row: Record<string, unknown>): OrderRefreshSnapshot {
  return {
    delivery_status: typeof row.delivery_status === "string" ? row.delivery_status : null,
    status: typeof row.status === "string" ? row.status : null,
    tracking_number: typeof row.tracking_number === "string" ? row.tracking_number : null,
    carrier_delivered_at:
      typeof row.carrier_delivered_at === "string" ? row.carrier_delivered_at : null,
    refunded_at: typeof row.refunded_at === "string" ? row.refunded_at : null,
  }
}

function isCarrierTrackingOnlyUpdate(
  prev: OrderRefreshSnapshot | null,
  next: OrderRefreshSnapshot,
): boolean {
  if (!prev) return false
  return (
    prev.delivery_status === next.delivery_status &&
    prev.status === next.status &&
    prev.tracking_number === next.tracking_number &&
    prev.carrier_delivered_at === next.carrier_delivered_at &&
    prev.refunded_at === next.refunded_at
  )
}

/**
 * Revalidates the current route when a single order row changes (e.g. Stripe webhook sets refunded).
 * Skips full-page refresh when only carrier tracking_detail was updated — the tracking panel polls locally.
 */
export function OrderDetailRealtimeRefresh({
  orderId,
  onUpdate,
}: {
  orderId: string
  /** When set (e.g. admin client fetch), invoked instead of `router.refresh()`. */
  onUpdate?: () => void
}) {
  const router = useRouter()
  const snapshotRef = useRef<OrderRefreshSnapshot | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    channel = supabase
      .channel(`order_detail_${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const next = snapshotFromRow(row)
          const trackingOnly = isCarrierTrackingOnlyUpdate(snapshotRef.current, next)
          snapshotRef.current = next

          if (trackingOnly) return

          onUpdate?.()
          if (!onUpdate) {
            router.refresh()
          }
        },
      )
      .subscribe()

    return () => {
      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [orderId, onUpdate, router])

  return null
}

/**
 * Revalidates the purchases or sales list when any of the user's marketplace purchases/sales change.
 */
export function OrdersListRealtimeRefresh({ role }: { role: "buyer" | "seller" }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    const chRef: { current: RealtimeChannel | null } = { current: null }

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const col = role === "buyer" ? "buyer_id" : "seller_id"
      const channel = supabase
        .channel(`orders_list_${role}_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `${col}=eq.${user.id}`,
          },
          () => {
            router.refresh()
          },
        )
        .subscribe()

      if (cancelled) {
        void supabase.removeChannel(channel)
        return
      }
      chRef.current = channel
    })()

    return () => {
      cancelled = true
      if (chRef.current) {
        void supabase.removeChannel(chRef.current)
      }
    }
  }, [role, router])

  return null
}
