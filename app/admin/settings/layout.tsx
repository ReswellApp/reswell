import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Settings — Admin — Reswell",
  description: "Internal configuration and feature flags for the Reswell platform.",
  path: "/admin/settings",
})

export default function AdminSettingsLayout({ children }: { children: ReactNode }) {
  return children
}
