import { privatePageMetadata } from "@/lib/site-metadata"
import { getPickupOnlySurfboardsDashboard } from "@/lib/services/pickupOnlySurfboards"
import { PickupOnlySurfboardsAdminClient } from "@/components/features/admin/pickup-only-surfboards-admin-client"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Pickup-only boards — Admin — Reswell",
  description:
    "Active surfboards that are local pickup only, mapped by city so you can run ads in each seller’s area.",
  path: "/admin/pickup-only-boards",
})

export default async function AdminPickupOnlyBoardsPage() {
  const initialData = await getPickupOnlySurfboardsDashboard()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pickup-only boards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every live surfboard that cannot ship — grouped by city so you can visualize inventory and
          run local ads where the boards actually are.
        </p>
      </div>
      <PickupOnlySurfboardsAdminClient initialData={initialData} />
    </div>
  )
}
