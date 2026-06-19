import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Wallet } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { listMyConsignments, type MyConsignmentItem } from "@/lib/db/consignmentStores"
import { getStripeConnectAccountByUserId } from "@/lib/db/stripeConnect"
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const metadata = privatePageMetadata({
  title: "My consignments — Reswell",
  description: "Boards you've consigned to shops, their status, and your payouts.",
  path: "/dashboard/consignments",
})

type StatusInfo = { label: string; variant: "default" | "secondary" | "outline" }

function statusInfo(item: MyConsignmentItem): StatusInfo {
  if (item.intakeStatus === "pending_approval") return { label: "Pending approval", variant: "secondary" }
  if (item.status === "sold") return { label: "Sold", variant: "default" }
  if (item.intakeStatus === "rejected" || item.status === "removed")
    return { label: "Not accepted", variant: "outline" }
  if (item.status === "active") return { label: "Live", variant: "default" }
  return { label: item.status, variant: "outline" }
}

export default async function MyConsignmentsPage() {
  const { supabase, user } = await getCachedDashboardSession()
  if (!user) return null

  const [items, connect] = await Promise.all([
    listMyConsignments(supabase, user.id),
    getStripeConnectAccountByUserId(supabase, user.id),
  ])

  const hasEarning = items.some((i) => i.status === "sold" || i.status === "active")
  const needsPayoutSetup = hasEarning && !connect?.payouts_enabled

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="My consignments"
        description="Boards you've handed to shops to sell on your behalf."
      />

      {needsPayoutSetup ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Set up payouts to cash out</p>
                <p className="text-sm text-muted-foreground">
                  Your consignment earnings collect in your Reswell wallet. Connect a bank to withdraw.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/earnings"
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Set up payouts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Link
          href="/dashboard/earnings"
          className="flex items-center justify-between rounded-lg border p-4 text-sm hover:border-foreground/30"
        >
          <span className="flex items-center gap-2 font-medium">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            View consignment earnings & payouts
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          You haven&apos;t consigned any boards yet. Scan a shop&apos;s intake QR to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const info = statusInfo(item)
            return (
              <Card key={item.listingId}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.coverUrl ? (
                      <Image
                        src={item.coverUrl}
                        alt={item.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.storeName ?? "Store"}
                      {" · "}
                      {item.intakeStatus === "pending_approval" && item.proposedPrice != null
                        ? `Proposed $${item.proposedPrice.toFixed(2)}`
                        : `Asking $${item.askingPrice.toFixed(2)}`}
                      {item.floorPrice != null ? ` · Floor $${item.floorPrice.toFixed(2)}` : ""}
                    </p>
                  </div>
                  <Badge variant={info.variant}>{info.label}</Badge>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
