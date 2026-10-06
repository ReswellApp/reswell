import Link from "next/link"
import { notFound } from "next/navigation"

import { AdminPageHeader } from "@/components/features/admin/admin-page-header"
import { getCoastalStops } from "@/lib/services/coastalDelivery"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Shipper stops — Admin — Reswell",
  description: "Fixed hand-delivery stops from Capitola to Bodega Bay.",
  path: "/admin/shipper/stops",
})

export default async function ShipperStopsPage() {
  const loaded = await getCoastalStops()
  if (!loaded.ok) notFound()

  const stops = loaded.data.stops

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Stops"
        description="Fixed towns, south to north. Drivers cover a subset of these. This is not live GPS."
        breadcrumbs={[
          { label: "Admin", href: "/admin/home" },
          { label: "Shipper", href: "/admin/shipper" },
          { label: "Stops" },
        ]}
        actions={
          <Link href="/admin/shipper" className="text-sm underline">
            All accounts
          </Link>
        }
      />
      {stops.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No stops yet.</p>
      ) : (
        <ol className="admin-surface divide-y">
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
    </div>
  )
}
