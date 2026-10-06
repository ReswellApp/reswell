import { notFound } from "next/navigation"

import { CoastalEnrollForm } from "@/components/features/admin/coastal-delivery/coastal-enroll-form"
import { CoastalShipperRoster } from "@/components/features/admin/coastal-delivery/coastal-shipper-roster"
import { getCoastalOverview } from "@/lib/services/coastalDelivery"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Coastal delivery — Admin — Reswell",
  description: "Signed-up coastal shippers and who is live this week.",
  path: "/admin/coastal-delivery",
})

export default async function CoastalDeliveryOverviewPage() {
  const loaded = await getCoastalOverview()
  if (!loaded.ok) notFound()

  const { stops, shippers } = loaded.data
  const liveCount = shippers.filter((shipper) => shipper.scheduleEnabled && shipper.enabledRunCount > 0).length
  const south = stops[0]?.name
  const north = stops[stops.length - 1]?.name

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Signed up" value={String(shippers.length)} hint="One shipper row per account" />
        <Stat label="Live" value={String(liveCount)} hint="Schedule on, with a run on" />
        <Stat
          label="Stops"
          value={String(stops.length)}
          hint={south && north ? `${south} through ${north}` : "Apply the coastal migration, then reload"}
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-medium">Accounts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only these accounts see Shipper on /dashboard. A shipper is live when the weekly schedule is on and at least one run is on.
            </p>
          </div>
          <CoastalShipperRoster shippers={shippers} />
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
          <h2 className="text-lg font-medium">Sign up an account</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Shops and other drivers join as their existing Reswell account. This does not open public signup.
          </p>
          <CoastalEnrollForm />
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}
