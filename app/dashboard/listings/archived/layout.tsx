import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Archived listings — Reswell",
  description: "Review surfboard listings you ended or archived and relist when you are ready.",
  path: "/dashboard/listings/archived",
})

export default function DashboardArchivedListingsLayout({ children }: { children: ReactNode }) {
  return children
}
