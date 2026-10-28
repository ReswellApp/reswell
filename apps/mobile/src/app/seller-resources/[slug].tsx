import { useLocalSearchParams } from "expo-router"
import { SalesMapScreen } from "@/components/sales-map/sales-map-screen"
import { SellerResourceDocument } from "@/components/seller-resources/seller-resource-document"

export default function SellerResourceScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  if (slug === "sales-map") {
    return <SalesMapScreen />
  }
  if (!slug) return null
  return <SellerResourceDocument slug={slug} />
}
