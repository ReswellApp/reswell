"use client"

import { useEffect, useRef } from "react"
import { parseSellListingPrice } from "@/lib/utils/sell-listing-price"

/**
 * Chrome can paint an autofilled price into a controlled input without
 * firing React's onChange, so validation still sees an empty string.
 */
export function useAdoptAutofilledSellPrice(
  inputId: string,
  value: string,
  onChange: (value: string) => void,
): void {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const adopt = () => {
      if (parseSellListingPrice(value) != null) return
      const el = document.getElementById(inputId)
      if (!(el instanceof HTMLInputElement)) return
      if (el.value === value) return
      if (parseSellListingPrice(el.value) == null) return
      onChangeRef.current(el.value)
    }

    adopt()
    const el = document.getElementById(inputId)
    el?.addEventListener("change", adopt)
    const timers = [50, 300, 1000].map((ms) => window.setTimeout(adopt, ms))
    return () => {
      el?.removeEventListener("change", adopt)
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [inputId, value])
}
