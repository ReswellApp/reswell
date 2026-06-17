"use client"

import { useSyncExternalStore } from "react"

const MOBILE_LG_QUERY = "(max-width: 1023px)"

function subscribeMobileLg(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_LG_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getMobileLgSnapshot() {
  return window.matchMedia(MOBILE_LG_QUERY).matches
}

function getMobileLgServerSnapshot() {
  return false
}

/** Matches Tailwind `lg:` breakpoint (1024px and up = desktop). */
export function useMobileLg() {
  return useSyncExternalStore(subscribeMobileLg, getMobileLgSnapshot, getMobileLgServerSnapshot)
}
