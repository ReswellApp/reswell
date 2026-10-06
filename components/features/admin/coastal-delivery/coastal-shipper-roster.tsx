import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { CoastalShipperSummary } from "@/lib/types/coastal-delivery"

interface CoastalShipperRosterProps {
  shippers: CoastalShipperSummary[]
}

export function CoastalShipperRoster({ shippers }: CoastalShipperRosterProps) {
  if (shippers.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
        No shippers yet. Sign up a Reswell account and they will see Shipper on their dashboard.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {shippers.map((shipper) => {
        const live = shipper.scheduleEnabled && shipper.enabledRunCount > 0
        return (
          <li key={shipper.id} className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-medium text-foreground">{shipper.displayName}</h3>
                  {shipper.isYou ? <Badge variant="secondary">You</Badge> : null}
                  {shipper.isShop ? <Badge variant="outline">Shop</Badge> : null}
                  <Badge variant={live ? "default" : "secondary"}>
                    {live ? "Live" : shipper.scheduleEnabled ? "Runs off" : "Off"}
                  </Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {shipper.email ?? "No email on this account"}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {shipper.enabledRunCount}/{shipper.runCount} runs on
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Link href={`/admin/coastal-delivery/schedule/${shipper.id}`} className="underline">
                Weekly schedule
              </Link>
              <Link href={`/coastal-delivery/${shipper.id}`} className="underline">
                Preview their run
              </Link>
              <span className="text-muted-foreground">Sees this on /dashboard/shipper</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
