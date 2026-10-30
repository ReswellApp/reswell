import { Redirect, useLocalSearchParams } from "expo-router"

function listingIdParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value.trim()
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim()
  return ""
}

/** Legacy path — edit lives at `/sell/edit/[id]` (same as the website). */
export default function LegacyEditListingRedirect() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>()
  const listingId = listingIdParam(id)
  if (!listingId) return <Redirect href="/account/listings" />
  return <Redirect href={`/sell/edit/${listingId}`} />
}
