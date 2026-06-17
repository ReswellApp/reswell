import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Listings — Reswell",
  description: "Manage your surfboard listings, track views, saves, and cart activity.",
  path: "/dashboard/listings",
})

export default function DashboardListingsLayout({ children }: { children: ReactNode }) {
  return children
}
