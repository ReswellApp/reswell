import Link from "next/link"
import { notFound } from "next/navigation"

import { CoastalScheduleEditor } from "@/components/features/admin/coastal-delivery/coastal-schedule-editor"
import { getCoastalSchedulePage } from "@/lib/services/coastalDelivery"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Coastal delivery schedule — Admin — Reswell",
  description: "Turn a coastal shipper weekly schedule on or off.",
  path: "/admin/coastal-delivery/schedule",
})

export default async function CoastalDeliverySchedulePage() {
  const loaded = await getCoastalSchedulePage()
  if (!loaded.ok) notFound()

  if (!loaded.data.profile) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Weekly schedule</h2>
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No shipper profile yet. Join first, then build a weekly run.
        </p>
        <Link href="/admin/coastal-delivery/join" className="text-sm underline">
          Join as a shipper
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Weekly schedule</h2>
      <CoastalScheduleEditor
        profile={loaded.data.profile}
        stops={loaded.data.stops}
        shipperId={loaded.data.profile.id}
      />
    </section>
  )
}
