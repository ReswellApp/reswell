import { Redirect, useLocalSearchParams } from "expo-router"
import { SellListingFlow } from "@/components/sell/sell-listing-flow"

export default function SellSectionScreen() {
  const params = useLocalSearchParams<{ section?: string }>()
  const category = typeof params.section === "string" ? params.section : ""

  if (category === "new" || category === "edit") {
    return <Redirect href="/sell/new" />
  }

  return <SellListingFlow key={category} initial={{ category }} />
}
