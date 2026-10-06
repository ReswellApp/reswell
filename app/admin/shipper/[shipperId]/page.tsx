import Link from "next/link"
import { notFound } from "next/navigation"

import { AdminPageHeader } from "@/components/features/admin/admin-page-header"
import { CoastalScheduleEditor } from "@/components/features/admin/coastal-delivery/coastal-schedule-editor"
import { getCoastalShipperSchedulePage } from "@/lib/services/coastalDelivery"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Shipper runs — Admin — Reswell",
  description: "Runs for a granted Shipper account.",
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={loaded.data.profile.displayName}
        description="These runs belong to this account. They turn Shipper on from their dashboard."
        breadcrumbs={[
          { label: "Admin", href: "/admin/home" },
          { label: "Shipper", href: "/admin/shipper" },
          { label: loaded.data.profile.displayName },
        ]}
        actions={
          <Link href="/admin/shipper" className="text-sm underline">
            All accounts
          </Link>
        }
      />
      <CoastalScheduleEditor
        profile={loaded.data.profile}
        stops={loaded.data.stops}
        shipperId={loaded.data.profile.id}
      />
    </div>
  )
}
