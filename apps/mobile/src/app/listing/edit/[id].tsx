import { Stack, useLocalSearchParams } from "expo-router"
import { SellListingFlow } from "@/components/sell/sell-listing-flow"

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const listingId = typeof id === "string" ? id : ""

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SellListingFlow editListingId={listingId} />
    </>
  )
}
