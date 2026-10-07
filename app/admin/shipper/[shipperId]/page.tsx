import { notFound } from "next/navigation"

import { AdminPageHeader } from "@/components/features/admin/admin-page-header"
import { ShipperServiceSwitch } from "@/components/features/admin/shipper/shipper-service-switch"
import { getCoastalShipperSchedulePage } from "@/lib/services/coastalDelivery"
import { shipperAccountLine, shipperWeekStatusLine } from "@/lib/services/coastalShipperWeek"
import { shipperPriceUsd } from "@/lib/utils/shipperPrice"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Shipper — Admin — Reswell",
  description: "A granted Shipper account.",
  path: "/admin/shipper",
})

const SHIPPER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function ShipperAccountPage({
  params,
}: {
  params: Promise<{ shipperId: string }>
}) {
  const { shipperId } = await params
  if (!SHIPPER_ID.test(shipperId)) notFound()

  const loaded = await getCoastalShipperSchedulePage(shipperId)
  if (!loaded.ok) notFound()

  const { profile } = loaded.data
  const weekly = profile.runs.filter((run) => !run.serviceDate).length
  const dated = profile.runs.length - weekly

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
      <div className="admin-surface space-y-2 p-5">
        <p className="text-sm text-foreground">
          ${shipperPriceUsd(profile.priceCents)} per board
          {" · "}
          {weekly} weekly {weekly === 1 ? "trip" : "trips"}
          {dated > 0 ? ` · ${dated} one-week ${dated === 1 ? "trip" : "trips"}` : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          They set the price, trips, regions, and cancellations on their Shipper dashboard. Admin grants accounts and can turn Shipper off.
        </p>
      </div>
    </div>
  )
}
