'use client'

import { useEffect } from 'react'

/**
 * Runs `effect` after `delayMs` of stability; clears the timer when deps change or on unmount.
 * Useful for route-driven beacons so rapid client navigations coalesce into one call.
 */
export function useDebouncedEffect(
  effect: () => void,
  deps: readonly unknown[],
  delayMs: number,
): void {
  useEffect(() => {
    const id = setTimeout(effect, delayMs)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns dep list
  }, deps)
}
