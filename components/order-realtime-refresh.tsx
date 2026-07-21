"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

function useDebouncedRouterRefresh(minIntervalMs = 1_500) {
  const router = useRouter()
  const lastRefreshAtRef = useRef(0)
  const pendingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current != null) {
        window.clearTimeout(pendingTimerRef.current)
      }
    }
  }, [])

  return useCallback(() => {
    const now = Date.now()
    const elapsed = now - lastRefreshAtRef.current
    if (elapsed >= minIntervalMs) {
      lastRefreshAtRef.current = now
      router.refresh()
      return
    }

    if (pendingTimerRef.current != null) return
    pendingTimerRef.current = window.setTimeout(() => {
      pendingTimerRef.current = null
      lastRefreshAtRef.current = Date.now()
      router.refresh()
    }, minIntervalMs - elapsed)
  }, [minIntervalMs, router])
}

/**
 * Revalidates the current route when a single order row changes
 * (delivery status, tracking detail, refunds, etc.).
 */
export function OrderDetailRealtimeRefresh({
  orderId,
  onUpdate,
}: {
  orderId: string
  /** When set (e.g. admin client fetch), invoked instead of `router.refresh()`. */
  onUpdate?: () => void
}) {
  const refresh = useDebouncedRouterRefresh()
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

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
          const custom = onUpdateRef.current
          if (custom) {
            custom()
            return
          }
          refresh()
        },
      )
      .subscribe()

    return () => {
      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [orderId, refresh])

  useEffect(() => {
    if (onUpdate) return

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", refresh)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", refresh)
    }
  }, [onUpdate, refresh])

  return null
}

/**
 * Revalidates the purchases or sales list when any of the user's marketplace purchases/sales change.
 * Also soft-refreshes when the tab becomes visible so badges stay accurate if Realtime was missed.
 */
export function OrdersListRealtimeRefresh({ role }: { role: "buyer" | "seller" }) {
  const refresh = useDebouncedRouterRefresh()

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
            refresh()
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
  }, [role, refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", refresh)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", refresh)
    }
  }, [refresh])

  return null
}
