"use client"

import { useEffect, useRef } from "react"
import { listingGallerySwipeDirection } from "@/lib/utils/listing-gallery-touch"

/**
 * Changes listing photos on a horizontal flick without calling `preventDefault`.
 * Used on phones, where Embla's drag listeners freeze the listing hero.
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
    let lastX = 0
    let lastY = 0
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
      lastX = startX
      lastY = startY
      onStartRef.current?.()
    }

    const onMove = (event: TouchEvent) => {
      if (!active) return
      const touch = event.touches[0]
      if (!touch) return
      lastX = touch.clientX
      lastY = touch.clientY
    }

    const finish = (x: number, y: number) => {
      if (!active) return
      active = false
      const dx = x - startX
      const dy = y - startY
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) onMovedRef.current?.()
      const direction = listingGallerySwipeDirection(dx, dy)
      if (!direction) return
      onSwipeRef.current(direction)
    }

    const onEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (!touch) {
        active = false
        return
      }
      finish(touch.clientX, touch.clientY)
    }

    // iOS cancels the touch when another listener calls preventDefault, and the
    // cancel point is often the start. The last move is the real flick.
    const onCancel = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      const cancelX = touch?.clientX ?? lastX
      const cancelY = touch?.clientY ?? lastY
      const cancelTravel = Math.abs(cancelX - startX) + Math.abs(cancelY - startY)
      const lastTravel = Math.abs(lastX - startX) + Math.abs(lastY - startY)
      if (lastTravel > cancelTravel) finish(lastX, lastY)
      else finish(cancelX, cancelY)
    }

    const options: AddEventListenerOptions = { passive: true }
    node.addEventListener("touchstart", onStart, options)
    node.addEventListener("touchmove", onMove, options)
    node.addEventListener("touchend", onEnd, options)
    node.addEventListener("touchcancel", onCancel, options)
    return () => {
      node.removeEventListener("touchstart", onStart)
      node.removeEventListener("touchmove", onMove)
      node.removeEventListener("touchend", onEnd)
      node.removeEventListener("touchcancel", onCancel)
    }
  }, [enabled, node])
}
