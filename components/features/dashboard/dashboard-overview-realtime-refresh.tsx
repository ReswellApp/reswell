"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

/**
 * Keeps the dashboard overview in sync when Supabase data changes
 * (purchases, listings, wallet, profile counts, follows, offers, favorites, notifications).
 */
export function DashboardOverviewRealtimeRefresh() {
  const router = useRouter()
  const supabase = useRef(createClient())

  useEffect(() => {
    let cancelled = false
    const client = supabase.current
    const channels: RealtimeChannel[] = []

    const refresh = () => {
      router.refresh()
    }

    const subscribe = (setup: (ch: ReturnType<typeof client.channel>) => RealtimeChannel) => {
      const ch = setup(client.channel(`db_overview_${Math.random().toString(36).slice(2)}`))
      channels.push(ch)
    }

    void (async () => {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user || cancelled) return

      subscribe((ch) =>
        ch
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
          .subscribe(),
      )

      subscribe((ch) =>
        ch
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
          .subscribe(),
      )

      subscribe((ch) =>
        ch
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
          .subscribe(),
      )

      subscribe((ch) =>
        ch
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
          .subscribe(),
      )

      subscribe((ch) =>
        ch
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
          .subscribe(),
      )

      subscribe((ch) =>
        ch
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
          .subscribe(),
      )

      subscribe((ch) =>
        ch
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
          .subscribe(),
      )

      subscribe((ch) =>
        ch
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
          .subscribe(),
      )

      subscribe((ch) =>
        ch
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
          .subscribe(),
      )

      subscribe((ch) =>
        ch
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
          .subscribe(),
      )
    })()

    return () => {
      cancelled = true
      for (const c of channels) {
        void client.removeChannel(c)
      }
      channels.length = 0
    }
  }, [router])

  return null
}
