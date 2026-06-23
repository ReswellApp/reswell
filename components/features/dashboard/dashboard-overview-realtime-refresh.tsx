"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

/**
 * Keeps the dashboard overview in sync when Supabase data changes
 * (purchases, listings, wallet, profile counts, follows, offers, favorites, notifications).
 * Uses one Realtime channel with multiple listeners to limit Postgres connection use.
 */
export function DashboardOverviewRealtimeRefresh() {
  const router = useRouter()
  const supabase = useRef(createClient())

  useEffect(() => {
    let cancelled = false
    const client = supabase.current
    let channel: RealtimeChannel | null = null

    const refresh = () => {
      router.refresh()
    }

    void (async () => {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user || cancelled) return

      channel = client
        .channel(`dashboard_overview_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `buyer_id=eq.${user.id}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `seller_id=eq.${user.id}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "listings",
            filter: `user_id=eq.${user.id}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallets",
            filter: `user_id=eq.${user.id}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "seller_follows",
            filter: `seller_id=eq.${user.id}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "seller_follows",
            filter: `follower_id=eq.${user.id}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "offers",
            filter: `seller_id=eq.${user.id}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "favorites",
            filter: `user_id=eq.${user.id}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          refresh,
        )
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) {
        void client.removeChannel(channel)
      }
    }
  }, [router])

  return null
}
