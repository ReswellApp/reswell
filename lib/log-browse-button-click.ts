import { logBrowseButtonClickAction } from "@/lib/actions/browseButtonActions"
import type { BrowseButtonCategory } from "@/lib/browse-button-tracking"
import type { BrowseButtonClickInput } from "@/lib/validations/browse-button-click"

/**
 * Fire-and-forget browse button click logging for client components. Never
 * throws and never blocks the UI; failures are only surfaced in development.
 */
export function logBrowseButtonClick(event: BrowseButtonClickInput): void {
  void logBrowseButtonClickAction(event)
    .then((res) => {
      if ("error" in res && process.env.NODE_ENV === "development") {
        console.warn("[browse] button click not recorded:", res.error, event)
      }
    })
    .catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[browse] button click failed:", err)
      }
    })
}

/** Convenience helper for individual facet filter interactions. */
export function logBrowseFacetClick(input: {
  category: BrowseButtonCategory
  facetKey: string
  facetValue?: string
  detail?: "select" | "deselect" | "set" | "clear"
}): void {
  logBrowseButtonClick({
    category: input.category,
    button: "facet",
    detail: input.detail,
    facetKey: input.facetKey,
    facetValue: input.facetValue,
  })
}

/** Format a min/max range for facet_value storage. */
export function browseFacetRangeValue(
  min: string | null | undefined,
  max: string | null | undefined,
): string {
  const lo = (min ?? "").trim()
  const hi = (max ?? "").trim()
  if (!lo && !hi) return ""
  return `${lo || "*"}-${hi || "*"}`
}
