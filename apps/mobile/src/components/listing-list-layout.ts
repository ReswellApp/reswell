import { Dimensions, StyleSheet } from "react-native"

/** Matches list `FlatList` horizontal padding (12 + 12). */
export const LISTING_LIST_HORIZONTAL_INSET = 24

/**
 * List photos span the content width (same inset as grid). Height is capped relative
 * to width so rows stay shorter than full 3:4 portrait without narrowing the tile.
 */
export function listingListImageHeight(windowWidth = Dimensions.get("window").width): number {
  const contentWidth = Math.max(0, windowWidth - LISTING_LIST_HORIZONTAL_INSET)
  return Math.round(contentWidth * 0.72)
}

/** @deprecated List tiles are full width; kept so stale Metro bundles do not crash on `.shell`. */
export const listingListTileShellStyle = StyleSheet.create({
  shell: { width: "100%" },
})
