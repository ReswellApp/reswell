import { notFound } from "next/navigation"

import { AdminPageHeader } from "@/components/features/admin/admin-page-header"
import { ShipperServiceSwitch } from "@/components/features/admin/shipper/shipper-service-switch"
import { ShipperWeekBoard } from "@/components/features/admin/shipper/shipper-week-board"
import { getCoastalShipperSchedulePage } from "@/lib/services/coastalDelivery"
import { shipperAccountLine, shipperWeekStatusLine } from "@/lib/services/coastalShipperWeek"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Shipper runs — Admin — Reswell",
  description: "Weekly runs for a granted Shipper account.",
  path: "/admin/shipper",
})

const SHIPPER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function ShipperRunsPage({
  params,
}: {
  params: Promise<{ shipperId: string }>
}) {
  const { shipperId } = await params
  if (!SHIPPER_ID.test(shipperId)) notFound()

  const loaded = await getCoastalShipperSchedulePage(shipperId)
  if (!loaded.ok) notFound()

  const { profile, stops } = loaded.data

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={profile.displayName}
        description={shipperAccountLine(profile)}
        breadcrumbs={[
          { label: "Admin", href: "/admin/home" },
          { label: "Shipper", href: "/admin/shipper" },
          { label: profile.displayName },
        ]}
        actions={<ShipperServiceSwitch shipperId={profile.id} scheduleEnabled={profile.scheduleEnabled} />}
      />
      <p className="text-sm text-muted-foreground">{shipperWeekStatusLine(profile)}</p>
      <ShipperWeekBoard profile={profile} stops={stops} shipperId={profile.id} />
    </div>
  )
}
