/**
 * A surfboard listing buyers can have shipped.
 * Pickup-only boards (`shipping_available` false or unset) are excluded.
 */
export function isShippableSurfboardListing(listing: {
  section?: string | null
  shipping_available?: boolean | null
}): boolean {
  return listing.section === "surfboards" && listing.shipping_available === true
}
