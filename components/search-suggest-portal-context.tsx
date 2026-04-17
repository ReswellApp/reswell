"use client"

import { createContext, useContext } from "react"

/**
 * When set (e.g. mobile nav search sheet), suggestion results portal into this node
 * so they stay inside the Radix dialog subtree — `aria-hidden` from `hideOthers()`
 * does not apply, so taps and scrolling work on iOS Safari.
 */
export const SearchSuggestPortalContainerContext = createContext<HTMLElement | null>(null)

export function useSearchSuggestPortalContainer() {
  return useContext(SearchSuggestPortalContainerContext)
}
