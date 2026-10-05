import { notFound } from "next/navigation"

import { CoastalShipperDashboard } from "@/components/features/coastal-delivery/coastal-shipper-dashboard"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCoastalShipperDashboard } from "@/lib/services/coastalShipperDashboard"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Coastal run — Reswell",
  description: "Weekly coastal surfboard hand-delivery run for a joined shipper.",
  path: "/coastal-delivery",
})

export default async function CoastalDeliveryShipperPage() {
  const loaded = await getCoastalShipperDashboard({ shipperId: null })
  if (!loaded.ok) {
    if (loaded.code === "not_found") notFound()
    throw new Error("Could not load the coastal run.")
  }
  return <CoastalShipperDashboard data={loaded.data} />
}
