"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import {
  listingPhotoWasPainted,
  rememberPaintedListingPhoto,
  resolveListingPhotoPainted,
} from "@/lib/listing-photo-paint"

/**
 * True when `src` can paint without a white stand-in.
 *
 * A photo this document already drew is ready on the first client render, so
 * back from a listing does not cover the tile with the near-white shimmer.
 * The check is a session set, not `new Image()` — probing would start a fetch
 * and pull every lazy tile on the page.
 *
 * Server render stays "not ready". Hydration promotes a known URL in
 * `useLayoutEffect`, still before paint. The `<img>` ref calls `markReady`
 * when the bitmap is already decoded, which also records it for the next mount.
 */
export function useCachedPhotoReady(src: string): {
  ready: boolean
  markReady: (seenSrc: string) => void
} {
  const srcRef = useRef(src)
  srcRef.current = src
  const [trackedSrc, setTrackedSrc] = useState(src)
  const [ready, setReady] = useState(() => listingPhotoWasPainted(src))

  let displayedReady = ready
  if (src !== trackedSrc) {
    displayedReady = resolveListingPhotoPainted({
      candidatesChanged: true,
      cached: listingPhotoWasPainted(src),
      loaded: false,
    })
    setTrackedSrc(src)
    setReady(displayedReady)
  }

  useLayoutEffect(() => {
    if (!src || displayedReady) return
    if (listingPhotoWasPainted(src)) setReady(true)
  }, [displayedReady, src])

  const markReady = useCallback((seenSrc: string) => {
    if (!seenSrc || seenSrc !== srcRef.current) return
    rememberPaintedListingPhoto(seenSrc)
    setReady(true)
  }, [])

  return { ready: src !== "" && displayedReady, markReady }
}
