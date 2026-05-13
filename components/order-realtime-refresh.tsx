"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

/**
 * Revalidates the current route when a single order row changes (e.g. Stripe webhook sets refunded).
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
        () => {
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
