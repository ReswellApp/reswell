import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "My listings — Reswell",
  description: "Publish, pause, or archive your surfboard listings and track views and messages.",
  path: "/dashboard/listings",
})

export default function DashboardListingsLayout({ children }: { children: ReactNode }) {
  return children
}
