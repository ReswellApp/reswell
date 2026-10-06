import Link from "next/link"
import { notFound } from "next/navigation"

import { CoastalScheduleEditor } from "@/components/features/admin/coastal-delivery/coastal-schedule-editor"
import { getCoastalShipperSchedulePage } from "@/lib/services/coastalDelivery"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Coastal shipper schedule — Admin — Reswell",
  description: "Build a signed-up account's weekly coastal runs.",
  path: "/admin/coastal-delivery/schedule",
})

const SHIPPER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function CoastalShipperSchedulePage({
  params,
}: {
  params: Promise<{ shipperId: string }>
}) {
  const { shipperId } = await params
  if (!SHIPPER_ID.test(shipperId)) notFound()

  const loaded = await getCoastalShipperSchedulePage(shipperId)
  if (!loaded.ok) notFound()

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Weekly schedule · {loaded.data.profile.displayName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Runs saved here belong to this account. They turn the schedule on from /dashboard/shipper.
          </p>
        </div>
        <Link href="/admin/coastal-delivery" className="text-sm underline">
          Back to accounts
        </Link>
      </div>
      <CoastalScheduleEditor
        profile={loaded.data.profile}
        stops={loaded.data.stops}
        shipperId={loaded.data.profile.id}
      />
    </section>
  )
}
