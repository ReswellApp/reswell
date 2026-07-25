"use client"

import dynamic from "next/dynamic"

function HiddenListingsPanelSkeleton() {
  return (
    <div className="flex items-center justify-center py-24" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-muted-foreground" />
    </div>
  )
}

export const AdminHiddenListingsPanelLazy = dynamic(
  () =>
    import("@/components/features/admin/admin-hidden-listings-panel").then(
      (mod) => mod.AdminHiddenListingsPanel,
    ),
  {
    ssr: false,
    loading: HiddenListingsPanelSkeleton,
  },
)
