"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { listingImageIsDecoded } from "@/lib/listing-photo-paint"

/**
 * True once the mounted listing photo has a decoded bitmap.
 *
 * Load state starts false (server HTML matches: wave on, image hidden).
 * Before the browser paints, and again on the next two frames, we read
 * `img.complete`. A cached photo from back-navigation flips to ready in that
 * window, so the wave never covers it. A new URL resets during render, not
 * in a passive effect after paint.
 */
export function useListingPhotoReady(src: string): {
  ready: boolean
  ref: (img: HTMLImageElement | null) => void
  onLoad: (img: HTMLImageElement) => void
} {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [trackedSrc, setTrackedSrc] = useState(src)
  const [ready, setReady] = useState(false)

  const srcChanged = src !== trackedSrc
  if (srcChanged) {
    setTrackedSrc(src)
    setReady(false)
  }

  const markIfDecoded = useCallback((img: HTMLImageElement | null) => {
    if (listingImageIsDecoded(img)) setReady(true)
  }, [])

  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      imgRef.current = img
      markIfDecoded(img)
    },
    [markIfDecoded],
  )

  const onLoad = useCallback(
    (img: HTMLImageElement) => {
      markIfDecoded(img)
    },
    [markIfDecoded],
  )

  useLayoutEffect(() => {
    const check = () => markIfDecoded(imgRef.current)
    check()
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(check)
    })
    return () => {
      cancelAnimationFrame(outer)
      if (inner) cancelAnimationFrame(inner)
    }
  }, [markIfDecoded, src])

  return {
    ready: src !== "" && !srcChanged && ready,
    ref,
    onLoad,
  }
}
