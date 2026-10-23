import { useLocalSearchParams } from "expo-router"
import { SellListingFlow } from "@/components/sell/sell-listing-flow"

export default function SellSectionScreen() {
  const params = useLocalSearchParams<{ section?: string }>()
  const category = typeof params.section === "string" ? params.section : ""

  return <SellListingFlow key={category} initial={{ category }} />
}
