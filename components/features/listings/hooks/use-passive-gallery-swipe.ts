"use client"

import { useEffect, useRef } from "react"
import { listingGallerySwipeDirection } from "@/lib/utils/listing-gallery-touch"

/**
 * Changes listing photos on a horizontal flick without calling `preventDefault`.
 * Used where Embla's drag listeners would freeze page scroll (Meta in-app browser).
 */
export function useListingGallerySwipe(
  enabled: boolean,
  node: HTMLElement | null,
  onSwipe: (direction: -1 | 1) => void,
  onMoved?: () => void,
  onStart?: () => void,
): void {
  const onSwipeRef = useRef(onSwipe)
  const onMovedRef = useRef(onMoved)
  const onStartRef = useRef(onStart)
  onSwipeRef.current = onSwipe
  onMovedRef.current = onMoved
  onStartRef.current = onStart

  useEffect(() => {
    if (!enabled || !node) return

    let startX = 0
    let startY = 0
    let active = false

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        active = false
        return
      }
      const target = event.target
      if (target instanceof Element && target.closest("video")) {
        active = false
        return
      }
      const touch = event.touches[0]
      if (!touch) {
        active = false
        return
      }
      active = true
      startX = touch.clientX
      startY = touch.clientY
      onStartRef.current?.()
    }

    const onEnd = (event: TouchEvent) => {
      if (!active) return
      active = false
      const touch = event.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) onMovedRef.current?.()
      const direction = listingGallerySwipeDirection(dx, dy)
      if (!direction) return
      onSwipeRef.current(direction)
    }

    const onCancel = () => {
      active = false
    }

    const options: AddEventListenerOptions = { passive: true }
    node.addEventListener("touchstart", onStart, options)
    node.addEventListener("touchend", onEnd, options)
    node.addEventListener("touchcancel", onCancel, options)
    return () => {
      node.removeEventListener("touchstart", onStart)
      node.removeEventListener("touchend", onEnd)
      node.removeEventListener("touchcancel", onCancel)
    }
  }, [enabled, node])
}
