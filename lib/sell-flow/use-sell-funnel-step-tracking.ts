"use client"

import { useEffect, useRef } from "react"

import { logSellFunnelEvent } from "@/lib/sell-flow/log-sell-funnel-event"
import type { PeerListingSection } from "@/lib/peer-listing-sections"

function sessionKey(prefix: string, listingType: PeerListingSection): string {
  return `reswell.sell.funnel.${prefix}.${listingType}`
}

function readViewedSteps(listingType: PeerListingSection): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = sessionStorage.getItem(sessionKey("viewed", listingType))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is string => typeof v === "string"))
  } catch {
    return new Set()
  }
}

function persistViewedSteps(listingType: PeerListingSection, viewed: Set<string>): void {
  try {
    sessionStorage.setItem(sessionKey("viewed", listingType), JSON.stringify([...viewed]))
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Session-scoped step instrumentation for `/sell` flows. Uses IntersectionObserver
 * for `step_viewed` and completion flips for `step_completed`.
 */
export function useSellFunnelStepTracking(input: {
  listingType: PeerListingSection
  sectionIds: readonly string[]
  sectionCompletion: Readonly<Partial<Record<string, boolean>>>
  enabled?: boolean
}): void {
  const { listingType, sectionIds, sectionCompletion, enabled = true } = input
  const sectionIdsKey = sectionIds.join("|")
  const prevCompletionRef = useRef<Record<string, boolean>>({})

  useEffect(() => {
    if (!enabled) return
    const key = sessionKey("started", listingType)
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, "1")
    logSellFunnelEvent({ listingType, event: "flow_started" })
  }, [enabled, listingType])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return

    const viewed = readViewedSteps(listingType)
    const observers: IntersectionObserver[] = []

    const markViewed = (stepId: string) => {
      if (viewed.has(stepId)) return
      viewed.add(stepId)
      persistViewedSteps(listingType, viewed)
      logSellFunnelEvent({
        listingType,
        event: "step_viewed",
        field: stepId,
      })
    }

    for (const stepId of sectionIds) {
      const attach = (attempt = 0) => {
        const el = document.getElementById(stepId)
        if (!el) {
          if (attempt < 120) window.requestAnimationFrame(() => attach(attempt + 1))
          return
        }
        if (viewed.has(stepId)) return

        const io = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting && entry.intersectionRatio >= 0.12) {
                markViewed(stepId)
                io.disconnect()
              }
            }
          },
          { threshold: [0, 0.12, 0.25], rootMargin: "0px 0px -8% 0px" },
        )
        io.observe(el)
        observers.push(io)
      }
      attach()
    }

    return () => {
      for (const io of observers) io.disconnect()
    }
  }, [enabled, listingType, sectionIdsKey, sectionIds])

  useEffect(() => {
    if (!enabled) return

    for (const stepId of sectionIds) {
      const complete = sectionCompletion[stepId] === true
      const wasComplete = prevCompletionRef.current[stepId] === true
      if (complete && !wasComplete) {
        logSellFunnelEvent({
          listingType,
          event: "step_completed",
          field: stepId,
        })
      }
    }

    prevCompletionRef.current = Object.fromEntries(
      sectionIds.map((id) => [id, sectionCompletion[id] === true]),
    )
  }, [enabled, listingType, sectionCompletion, sectionIdsKey, sectionIds])
}
