"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  UNREAD_SUPPORT_COUNT_ADJUST_EVENT,
  UNREAD_SUPPORT_COUNT_REFRESH_EVENT,
  UNREAD_SUPPORT_COUNT_SET_EVENT,
  type UnreadSupportCountAdjustDetail,
  type UnreadSupportCountSetDetail,
} from "@/lib/utils/unread-support-count-events"

function parseCount(value: unknown): number | null {
  if (value == null) return null
  const next = Number(value)
  if (!Number.isFinite(next)) return null
  return Math.max(0, next)
}

type Listener = (count: number) => void

let sharedCount = 0
let started = false
const listeners = new Set<Listener>()
let cleanupShared: (() => void) | null = null

function emit(next: number) {
  sharedCount = next
  for (const listener of listeners) listener(next)
}

function startSharedSubscription() {
  if (started || typeof window === "undefined") return
  started = true
  const supabase = createClient()
  let channel: ReturnType<typeof supabase.channel> | null = null
  let cancelled = false

  async function refreshFromProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || cancelled) return
    const { data } = await supabase
      .from("profiles")
      .select("unread_support_count")
      .eq("id", user.id)
      .maybeSingle()
    const next = parseCount(data?.unread_support_count)
    if (next == null || cancelled) return
    emit(next)
  }

  function onAdjust(event: Event) {
    const delta = (event as CustomEvent<UnreadSupportCountAdjustDetail>).detail?.delta
    if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) return
    emit(Math.max(0, sharedCount + delta))
  }

  function onSet(event: Event) {
    const next = parseCount((event as CustomEvent<UnreadSupportCountSetDetail>).detail?.count)
    if (next == null) return
    emit(next)
  }

  function onRefresh() {
    void refreshFromProfile()
  }

  window.addEventListener(UNREAD_SUPPORT_COUNT_ADJUST_EVENT, onAdjust)
  window.addEventListener(UNREAD_SUPPORT_COUNT_SET_EVENT, onSet)
  window.addEventListener(UNREAD_SUPPORT_COUNT_REFRESH_EVENT, onRefresh)
  void refreshFromProfile()

  void (async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || cancelled) return
    channel = supabase
      .channel(`unread_support_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const next = parseCount(
            (payload.new as { unread_support_count?: unknown } | null)?.unread_support_count,
          )
          if (next == null) return
          emit(next)
        },
      )
      .subscribe()
  })()

  cleanupShared = () => {
    cancelled = true
    window.removeEventListener(UNREAD_SUPPORT_COUNT_ADJUST_EVENT, onAdjust)
    window.removeEventListener(UNREAD_SUPPORT_COUNT_SET_EVENT, onSet)
    window.removeEventListener(UNREAD_SUPPORT_COUNT_REFRESH_EVENT, onRefresh)
    if (channel) void supabase.removeChannel(channel)
    started = false
    cleanupShared = null
  }
}

function subscribeShared(listener: Listener): () => void {
  listeners.add(listener)
  startSharedSubscription()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) cleanupShared?.()
  }
}

export function useLiveUnreadSupportCount(initialCount = 0): number {
  const [count, setCount] = useState(() => Math.max(0, initialCount))

  useEffect(() => {
    setCount((prev) => (initialCount > prev ? initialCount : prev))
  }, [initialCount])

  useEffect(() => {
    return subscribeShared((next) => setCount(next))
  }, [])

  return count
}
