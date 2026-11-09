import { notFound } from "next/navigation"

import { DashboardDropoffLocationHome } from "@/components/features/dashboard/dropoff-location/dashboard-dropoff-location-home"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getDropoffLocationDashboard } from "@/lib/services/dropoffLocationDashboard"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Drop-off — Reswell",
  description: "Boards dropped at your location, and the shipping labels for those orders.",
  path: "/dashboard/dropoff-location",
})

export default async function DashboardDropoffLocationPage() {
  const loaded = await getDropoffLocationDashboard()
  if (!loaded.ok) {
    if (loaded.code === "not_found") notFound()
    throw new Error("Could not load the dropoff dashboard.")
  }

  return <DashboardDropoffLocationHome data={loaded.data} />
}
