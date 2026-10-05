import Link from "next/link"
import { notFound } from "next/navigation"

import { getCoastalOverview } from "@/lib/services/coastalDelivery"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Coastal delivery — Admin — Reswell",
  description: "Admin draft of coastal surfboard hand delivery.",
  path: "/admin/coastal-delivery",
})

export default async function CoastalDeliveryOverviewPage() {
  const loaded = await getCoastalOverview()
  if (!loaded.ok) notFound()

  const { stops, shippers, joined } = loaded.data
  const schedulesOff = shippers.length > 0 && shippers.every((shipper) => !shipper.scheduleEnabled)
  const south = stops[0]?.name
  const north = stops[stops.length - 1]?.name

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Overview</h2>
        {stops.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No coastal stops yet. Apply the coastal delivery migration, then reload.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {stops.length} stops, south to north: {south} through {north}.
          </p>
        )}
        {shippers.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No shippers yet. Join to preview the driver profile.
          </p>
        ) : null}
        {schedulesOff ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Every weekly schedule is off. Matching will not offer these shippers until a schedule is turned on.
          </p>
        ) : null}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Shippers</h2>
        {shippers.length === 0 ? (
          <Link href="/admin/coastal-delivery/join" className="text-sm underline">
            Join as a shipper
          </Link>
        ) : (
          <ul className="divide-y rounded-lg border">
            {shippers.map((shipper) => (
              <li key={shipper.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  {shipper.displayName}
                  {shipper.isYou ? " (you)" : ""}
                </span>
                <span className="text-muted-foreground">
                  {shipper.scheduleEnabled ? "Schedule on" : "Schedule off"} · {shipper.enabledRunCount}/
                  {shipper.runCount} runs on
                </span>
              </li>
            ))}
          </ul>
        )}
        {joined ? (
          <Link href="/admin/coastal-delivery/schedule" className="text-sm underline">
            Edit your weekly schedule
          </Link>
        ) : null}
      </section>
    </div>
  )
}
