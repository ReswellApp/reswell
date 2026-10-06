import Link from "next/link"

import { AdminStatusPill } from "@/components/features/admin/admin-status-pill"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CoastalShipperSummary } from "@/lib/types/coastal-delivery"

interface ShipperRosterProps {
  shippers: CoastalShipperSummary[]
}

export function ShipperRoster({ shippers }: ShipperRosterProps) {
  if (shippers.length === 0) {
    return (
      <div className="admin-surface px-6 py-16 text-center">
        <p className="font-medium text-foreground">No one has Shipper yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Grant a Reswell account and it will show up here.</p>
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {shippers.map((shipper) => (
          <li key={shipper.id} className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{shipper.displayName}</p>
                <p className="truncate text-sm text-muted-foreground">{shipper.email ?? "No email"}</p>
              </div>
              <ShipperStatus shipper={shipper} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {shipper.isShop ? <Badge variant="outline">Shop</Badge> : null}
              {shipper.isYou ? <Badge variant="secondary">You</Badge> : null}
              <span>
                {shipper.enabledRunCount}/{shipper.runCount} runs on
              </span>
            </div>
            <Link href={`/admin/shipper/${shipper.id}`} className="mt-3 inline-flex text-sm font-medium underline">
              Open runs
            </Link>
          </li>
        ))}
      </ul>

      <div className="admin-surface hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shippers.map((shipper) => (
              <TableRow key={shipper.id}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{shipper.displayName}</span>
                    {shipper.isShop ? <Badge variant="outline">Shop</Badge> : null}
                    {shipper.isYou ? <Badge variant="secondary">You</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{shipper.email ?? "No email on this account"}</p>
                </TableCell>
                <TableCell>
                  <ShipperStatus shipper={shipper} />
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {shipper.enabledRunCount}/{shipper.runCount} on
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/shipper/${shipper.id}`} className="text-sm font-medium underline">
                    Open runs
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function ShipperStatus({ shipper }: { shipper: CoastalShipperSummary }) {
  if (shipper.scheduleEnabled && shipper.enabledRunCount > 0) {
    return <AdminStatusPill label="Service on" tone="green" />
  }
  if (shipper.scheduleEnabled) {
    return <AdminStatusPill label="No runs on" tone="amber" />
  }
  return <AdminStatusPill label="Service off" tone="slate" />
}
