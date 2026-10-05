import { notFound } from "next/navigation"

import { CoastalShipperDashboard } from "@/components/features/coastal-delivery/coastal-shipper-dashboard"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCoastalShipperDashboard } from "@/lib/services/coastalShipperDashboard"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Coastal run — Reswell",
  description: "Preview of a coastal shipper run dashboard.",
  path: "/coastal-delivery",
})

export default async function CoastalDeliveryShipperPreviewPage({
  params,
}: {
  params: Promise<{ shipperId: string }>
}) {
  const { shipperId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shipperId)) {
    notFound()
  }
  const loaded = await getCoastalShipperDashboard({ shipperId })
  if (!loaded.ok) {
    if (loaded.code === "not_found") notFound()
    throw new Error("Could not load the coastal run.")
  }
  return <CoastalShipperDashboard data={loaded.data} />
}
