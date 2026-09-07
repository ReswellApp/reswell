import { privatePageMetadata } from "@/lib/site-metadata"
import { GiveawayAdminDashboardView } from "@/components/features/admin/giveaway-admin-dashboard"
import { WIN_A_SURFBOARD_GIVEAWAY_SLUG } from "@/lib/giveaways/catalog"
import { getGiveawayAdminDashboard } from "@/lib/services/giveawayEntry"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Giveaways — Reswell admin",
  description:
    "Giveaway button clicks, signups, brand picks, and the listing attached to each raffle entry.",
  path: "/admin/giveaways",
})

export default async function AdminGiveawaysPage() {
  const data = await getGiveawayAdminDashboard(WIN_A_SURFBOARD_GIVEAWAY_SLUG)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Giveaways</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who clicked the list-to-win button, which custom they want, and the listing ID that keeps
          them in the raffle after a sale.
        </p>
      </div>
      {data ? (
        <GiveawayAdminDashboardView data={data} />
      ) : (
        <p className="text-sm text-muted-foreground">No active giveaway found.</p>
      )}
    </div>
  )
}
