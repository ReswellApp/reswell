import type { Metadata } from "next"
import { SalesMapPageLoader } from "@/components/features/map/sales-map-page-loader"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("map")
}

export default function MapPage() {
  return <SalesMapPageLoader />
}
