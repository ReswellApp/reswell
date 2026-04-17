import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Add listing — Admin — Reswell",
  description: "Create or stage a marketplace listing from the Reswell admin console.",
  path: "/admin/listings/add",
})

export default function AdminAddListingLayout({ children }: { children: ReactNode }) {
  return children
}
