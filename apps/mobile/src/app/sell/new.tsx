import { useLocalSearchParams } from "expo-router"
import { SellListingFlow } from "@/components/sell/sell-listing-flow"

function textParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : ""
}

export default function SellNewScreen() {
  const params = useLocalSearchParams<{
    title?: string
    brand?: string
    model?: string
    category?: string
    subcategory?: string
  }>()

  return (
    <SellListingFlow
      key={[params.brand, params.model, params.category, params.subcategory].join(":")}
      initial={{
        title: textParam(params.title),
        brand: textParam(params.brand),
        model: textParam(params.model),
        category: textParam(params.category),
        subcategory: textParam(params.subcategory),
      }}
    />
  )
}
