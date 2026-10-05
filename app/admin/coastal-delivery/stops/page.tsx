import { notFound } from "next/navigation"

import { getCoastalStops } from "@/lib/services/coastalDelivery"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Coastal delivery stops — Admin — Reswell",
  description: "Fixed hand-delivery stops from Capitola to Bodega Bay.",
  path: "/admin/coastal-delivery/stops",
})

export default async function CoastalDeliveryStopsPage() {
  const loaded = await getCoastalStops()
  if (!loaded.ok) notFound()

  const stops = loaded.data.stops

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Stops</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Fixed towns, south to north. Capitola is south of Santa Cruz. Bodega Bay is the North Coast
          stop past Bolinas. Drivers cover a subset of these stops. This is not live GPS.
        </p>
      </div>
      {stops.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No stops yet. Apply the coastal delivery migration.
        </p>
      ) : (
        <ol className="divide-y rounded-lg border">
          {stops.map((stop, index) => (
            <li key={stop.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                {index + 1}. {stop.name}
              </span>
              <span className="text-muted-foreground">{stop.slug}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
