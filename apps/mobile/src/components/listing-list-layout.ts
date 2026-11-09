import { StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import type { ListingLayout } from "@/components/listing-layout-switch"

/** Matches list `FlatList` horizontal padding (12 + 12). */
export const LISTING_LIST_HORIZONTAL_INSET = 24

/** Same portrait frame as grid tiles, shop tiles, and the website listing hero. */
export const LISTING_TILE_ASPECT = 3 / 4

/** Single-column rows: slightly inset media so tiles breathe vs edge-to-edge (~3% each side). */
export const LISTING_LIST_MEDIA_WIDTH = "94%"

/** Single-column row width — seller bar, photo, and copy share one column (not inside `StyleSheet.create`). */
export const listingListColumnStyle: ViewStyle = {
  alignSelf: "center",
  width: LISTING_LIST_MEDIA_WIDTH,
  gap: 8,
}

/** @deprecated Use {@link listingListColumnStyle}. */
export const listingListMediaFrameStyle = listingListColumnStyle

/** FlatList content padding when `ListingLayout` is `list` (matches feed single column). */
export const listingListFlatListPadding: ViewStyle = {
  paddingHorizontal: 12,
}

export function marketplaceListContentStyle(
  base: StyleProp<ViewStyle>,
  layout: ListingLayout,
): StyleProp<ViewStyle> {
  return layout === "list" ? [base, listingListFlatListPadding] : base
}

/** @deprecated List tiles are full width; kept so stale Metro bundles do not crash on `.shell`. */
export const listingListTileShellStyle = StyleSheet.create({
  shell: { width: "100%" },
})
