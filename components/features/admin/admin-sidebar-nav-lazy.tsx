"use client"

import dynamic from "next/dynamic"
import type { AdminNavGroupConfig } from "@/lib/admin-nav"
import type { AdminNavBadgeCounts } from "@/lib/admin-nav-badge-counts"

function AdminSidebarNavSkeleton() {
  return (
    <div className="space-y-2 animate-pulse" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1">
          <div className="h-9 rounded-md bg-muted" />
          <div className="ml-2 h-8 rounded-md bg-muted/70" />
          <div className="ml-2 h-8 rounded-md bg-muted/70" />
        </div>
      ))}
    </div>
  )
}

const AdminSidebarNav = dynamic(
  () =>
    import("@/components/features/admin/admin-sidebar-nav").then(
      (mod) => mod.AdminSidebarNav,
    ),
  {
    ssr: false,
    loading: AdminSidebarNavSkeleton,
  },
)

export function AdminSidebarNavLazy(props: {
  groups: AdminNavGroupConfig[]
  badgeCounts?: AdminNavBadgeCounts
}) {
  return <AdminSidebarNav {...props} />
}
