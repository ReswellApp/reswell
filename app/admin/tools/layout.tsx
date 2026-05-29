import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Admin tools — Admin — Reswell",
  description: "Operational maintenance tools: search reindex, sitemap, cache, and lifecycle jobs.",
  path: "/admin/tools",
})

export default function AdminToolsLayout({ children }: { children: ReactNode }) {
  return children
}
