"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

/**
 * Revalidates `/messages` when conversations change for the signed-in user
 * (new thread, new message via `last_message_at` update).
 */
export function MessagesInboxRealtimeRefresh({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = useRef(createClient())

  useEffect(() => {
    const client = supabase.current
    const channels: RealtimeChannel[] = []
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    // Debounce: a burst of conversation updates (e.g. several messages landing
    // at once) should trigger a single server reload, not one per event.
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        router.refresh()
      }, 400)
    }

    const subscribe = (setup: (ch: ReturnType<typeof client.channel>) => RealtimeChannel) => {
      const ch = setup(client.channel(`messages_inbox_${Math.random().toString(36).slice(2)}`))
      channels.push(ch)
    }

    subscribe((ch) =>
      ch
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
            filter: `buyer_id=eq.${userId}`,
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
            table: "conversations",
            filter: `seller_id=eq.${userId}`,
          },
          refresh,
        )
        .subscribe(),
    )

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      for (const ch of channels) {
        void client.removeChannel(ch)
      }
    }
  }, [userId, router])

  return null
}
