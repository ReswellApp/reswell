import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Orders — Admin — Reswell",
  description: "Search and inspect marketplace orders, payments, and fulfillment status.",
  path: "/admin/orders",
})

export default function AdminOrdersLayout({ children }: { children: ReactNode }) {
  return children
}
