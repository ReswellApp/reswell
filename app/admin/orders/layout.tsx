import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Orders — Admin — Reswell",
  description: "Work through marketplace orders by what needs to happen next.",
  path: "/admin/orders",
})

export default function AdminOrdersLayout({ children }: { children: ReactNode }) {
  return children
}
