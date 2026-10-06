import { notFound } from "next/navigation"

import { DashboardShipperHome } from "@/components/features/dashboard/shipper/dashboard-shipper-home"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCoastalShipperDashboard } from "@/lib/services/coastalShipperDashboard"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Shipper — Reswell",
  description: "Your coastal runs, this week's boards, and the schedule buyers can match.",
  path: "/dashboard/shipper",
})

export default async function DashboardShipperPage() {
  const loaded = await getCoastalShipperDashboard({ shipperId: null })
  if (!loaded.ok) {
    if (loaded.code === "not_found") notFound()
    throw new Error("Could not load the shipper dashboard.")
  }

  return <DashboardShipperHome data={loaded.data} />
}
