import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Order support — Admin — Reswell",
  description: "Help buyers and sellers resolve disputes, refunds, and delivery issues on Reswell orders.",
  path: "/admin/order-support",
})

export default function AdminOrderSupportLayout({ children }: { children: ReactNode }) {
  return children
}
