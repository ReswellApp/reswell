"use client"

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react"
import {
  applyListingPdpCropPan,
  applyListingPdpCropZoom,
  type ListingPdpCropLayout,
} from "@/lib/utils/listing-pdp-crop"

type FrameSize = { w: number; h: number }
type ImageSize = { w: number; h: number }

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function useListingPdpCropGestures(params: {
  enabled: boolean
  frameRef: React.RefObject<HTMLElement | null>
  layout: ListingPdpCropLayout | null
  frame: FrameSize | null
  image: ImageSize | null
  onLayout: (next: ListingPdpCropLayout) => void
  onInteracting: (active: boolean) => void
}) {
  const { enabled, frameRef, layout, frame, image, onLayout, onInteracting } = params
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const panRef = useRef<{ x: number; y: number; layout: ListingPdpCropLayout } | null>(null)
  const pinchRef = useRef<{
    distance: number
    layout: ListingPdpCropLayout
  } | null>(null)
  const layoutRef = useRef(layout)
  const frameSizeRef = useRef(frame)
  const imageSizeRef = useRef(image)
  const onLayoutRef = useRef(onLayout)
  const onInteractingRef = useRef(onInteracting)

  layoutRef.current = layout
  frameSizeRef.current = frame
  imageSizeRef.current = image
  onLayoutRef.current = onLayout
  onInteractingRef.current = onInteracting

  function framePoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = frameRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function beginGesture() {
    const pts = [...pointersRef.current.values()]
    const current = layoutRef.current
    if (!current) return
    if (pts.length >= 2) {
      pinchRef.current = { distance: Math.max(1, distance(pts[0], pts[1])), layout: current }
      panRef.current = null
      return
    }
    if (pts.length === 1) {
      panRef.current = { x: pts[0].x, y: pts[0].y, layout: current }
      pinchRef.current = null
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!enabled || !layoutRef.current) return
    event.preventDefault()
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)
    beginGesture()
    onInteractingRef.current(true)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const frameSize = frameSizeRef.current
    const imageSize = imageSizeRef.current
    if (!frameSize || !imageSize) return

    const pts = [...pointersRef.current.values()]
    if (pts.length >= 2 && pinchRef.current) {
      const origin = framePoint(
        midpoint(pts[0], pts[1]).x,
        midpoint(pts[0], pts[1]).y,
      )
      if (!origin) return
      const nextDist = Math.max(1, distance(pts[0], pts[1]))
      onLayoutRef.current(
        applyListingPdpCropZoom({
          layout: pinchRef.current.layout,
          factor: nextDist / pinchRef.current.distance,
          originX: origin.x,
          originY: origin.y,
          frameW: frameSize.w,
          frameH: frameSize.h,
          imageW: imageSize.w,
          imageH: imageSize.h,
        }),
      )
      return
    }

    const pan = panRef.current
    if (pts.length === 1 && pan) {
      onLayoutRef.current(
        applyListingPdpCropPan({
          layout: pan.layout,
          deltaX: pts[0].x - pan.x,
          deltaY: pts[0].y - pan.y,
          frameW: frameSize.w,
          frameH: frameSize.h,
        }),
      )
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.delete(event.pointerId)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // already released
    }
    if (pointersRef.current.size === 0) {
      panRef.current = null
      pinchRef.current = null
      onInteractingRef.current(false)
      return
    }
    beginGesture()
  }

  useEffect(() => {
    const el = frameRef.current
    if (!el || !enabled) return

    const onWheel = (event: WheelEvent) => {
      if (!layoutRef.current || !frameSizeRef.current || !imageSizeRef.current) return
      event.preventDefault()
      const origin = framePoint(event.clientX, event.clientY)
      if (!origin) return
      const factor = Math.exp(-event.deltaY * 0.0016)
      onLayoutRef.current(
        applyListingPdpCropZoom({
          layout: layoutRef.current,
          factor,
          originX: origin.x,
          originY: origin.y,
          frameW: frameSizeRef.current.w,
          frameH: frameSizeRef.current.h,
          imageW: imageSizeRef.current.w,
          imageH: imageSizeRef.current.h,
        }),
      )
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [enabled, frameRef])

  return { onPointerDown, onPointerMove, onPointerUp }
}
