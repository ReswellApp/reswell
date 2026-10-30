import { Stack, useLocalSearchParams } from "expo-router"
import { SellListingFlow } from "@/components/sell/sell-listing-flow"

function listingIdParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value.trim()
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim()
  return ""
}

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>()
  const listingId = listingIdParam(id)

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SellListingFlow editListingId={listingId} />
    </>
  )
}
