import Link from "next/link"
import { notFound } from "next/navigation"

import { AdminPageHeader } from "@/components/features/admin/admin-page-header"
import { AdminStatStrip } from "@/components/features/admin/admin-stat-strip"
import { ShipperGrantDialog } from "@/components/features/admin/shipper/shipper-grant-dialog"
import { ShipperRoster } from "@/components/features/admin/shipper/shipper-roster"
import { Button } from "@/components/ui/button"
import { getCoastalOverview } from "@/lib/services/coastalDelivery"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Shipper — Admin — Reswell",
  description: "Grant Shipper and see who has the service on.",
  path: "/admin/shipper",
})

export default async function ShipperAdminPage() {
  const loaded = await getCoastalOverview()
  if (!loaded.ok) notFound()

  const { stops, shippers } = loaded.data
  const serviceOn = shippers.filter((shipper) => shipper.scheduleEnabled).length
  const takingBoards = shippers.filter((shipper) => shipper.scheduleEnabled && shipper.enabledRunCount > 0).length
  const south = stops[0]?.name
  const north = stops[stops.length - 1]?.name

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Shipper"
        description="Accounts that can drive Shipper. Grant stays in the dialog. Buyers still do not see it."
        breadcrumbs={[{ label: "Admin", href: "/admin/home" }, { label: "Shipper" }]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/shipper/stops">Stops</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/shipper/preview">Listing preview</Link>
            </Button>
            <ShipperGrantDialog />
          </>
        }
      />
      <AdminStatStrip
        items={[
          { label: "Granted", value: String(shippers.length), footnote: "One row per account", tone: "teal" },
          { label: "Service on", value: String(serviceOn), footnote: "They turned Shipper on", tone: "blue" },
          { label: "Taking boards", value: String(takingBoards), footnote: "Service on, with a run on", tone: "green" },
          {
            label: "Stops",
            value: String(stops.length),
            footnote: south && north ? `${south} through ${north}` : "Corridor not loaded",
            tone: "violet",
          },
        ]}
      />
      <ShipperRoster shippers={shippers} />
    </div>
  )
}
