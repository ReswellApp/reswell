"use client"

import { CoastalJoinForm } from "@/components/features/admin/coastal-delivery/coastal-join-form"

export function DashboardShipperJoin() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-foreground">Shipper</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Drive boards between California sellers and buyers. Join once, then set your price, trips, and
          regions on this dashboard.
        </p>
      </div>
      <CoastalJoinForm profile={null} />
    </div>
  )
}
