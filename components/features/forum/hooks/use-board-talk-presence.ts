"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type BoardTalkPresenceEntry = {
  key: string
  type: "member" | "guest"
  displayName?: string
}

const GUEST_STORAGE_KEY = "board-talk-guest-id"
const PRESENCE_CHANNEL = "board-talk:hangout"

function getOrCreateGuestKey(): string {
  if (typeof sessionStorage === "undefined") {
    return `guest-${Math.random().toString(36).slice(2)}`
  }
  let id = sessionStorage.getItem(GUEST_STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(GUEST_STORAGE_KEY, id)
  }
  return id
}

type PresencePayload = {
  type: "member" | "guest"
  displayName?: string
}

function parsePresenceState(
  state: Record<string, PresencePayload[]>,
): BoardTalkPresenceEntry[] {
  const entries: BoardTalkPresenceEntry[] = []
  for (const [key, payloads] of Object.entries(state)) {
    const latest = payloads[payloads.length - 1]
    if (!latest) continue
    entries.push({
      key,
      type: latest.type,
      displayName: latest.displayName?.trim() || undefined,
    })
  }
  return entries
}

export function useBoardTalkPresence(displayName: string | null, userId: string | null) {
  const supabase = useMemo(() => createClient(), [])
  const [entries, setEntries] = useState<BoardTalkPresenceEntry[]>([])

  useEffect(() => {
    const presenceKey = userId ?? getOrCreateGuestKey()
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: presenceKey } },
    })

    channel.on("presence", { event: "sync" }, () => {
      setEntries(parsePresenceState(channel.presenceState() as Record<string, PresencePayload[]>))
    })

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return
      if (userId) {
        await channel.track({
          type: "member",
          displayName: displayName?.trim() || "Member",
        })
      } else {
        await channel.track({ type: "guest" })
      }
    })

    return () => {
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
  }, [supabase, userId, displayName])

  const members = useMemo(
    () => entries.filter((e) => e.type === "member"),
    [entries],
  )
  const guestCount = useMemo(
    () => entries.filter((e) => e.type === "guest").length,
    [entries],
  )

  return { members, guestCount, total: entries.length }
}
