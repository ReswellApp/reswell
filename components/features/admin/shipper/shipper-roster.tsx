import Link from "next/link"

import { AdminStatusPill } from "@/components/features/admin/admin-status-pill"
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
            <p className="truncate font-medium text-foreground">{shipper.displayName}</p>
            <p className="truncate text-sm text-muted-foreground">{shipper.email ?? "No email"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ShopMark isShop={shipper.isShop} />
              <ServiceMark enabled={shipper.scheduleEnabled} />
              <RunMark hasRun={shipper.runCount > 0} />
            </div>
            <Link href={`/admin/shipper/${shipper.id}`} className="mt-3 inline-flex text-sm font-medium underline">
              Open
            </Link>
          </li>
        ))}
      </ul>

      <div className="admin-surface hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Shop</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Run</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shippers.map((shipper) => (
              <TableRow key={shipper.id}>
                <TableCell className="font-medium text-foreground">{shipper.displayName}</TableCell>
                <TableCell className="text-muted-foreground">{shipper.email ?? "No email"}</TableCell>
                <TableCell>
                  <ShopMark isShop={shipper.isShop} />
                </TableCell>
                <TableCell>
                  <ServiceMark enabled={shipper.scheduleEnabled} />
                </TableCell>
                <TableCell>
                  <RunMark hasRun={shipper.runCount > 0} />
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/shipper/${shipper.id}`} className="text-sm font-medium underline">
                    Open
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

function ShopMark({ isShop }: { isShop: boolean }) {
  return isShop ? <AdminStatusPill label="Shop" tone="blue" /> : <span className="text-sm text-muted-foreground">—</span>
}

function ServiceMark({ enabled }: { enabled: boolean }) {
  return <AdminStatusPill label={enabled ? "On" : "Off"} tone={enabled ? "green" : "slate"} />
}

function RunMark({ hasRun }: { hasRun: boolean }) {
  return <AdminStatusPill label={hasRun ? "Has a run" : "No run"} tone={hasRun ? "green" : "slate"} />
}
