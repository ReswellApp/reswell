import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Listings — Admin — Reswell",
  description: "Moderate surfboard listings, visibility, and policy issues across the marketplace.",
  path: "/admin/listings",
})

export default function AdminListingsLayout({ children }: { children: ReactNode }) {
  return children
}
