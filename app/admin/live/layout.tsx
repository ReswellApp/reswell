import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Live activity — Admin — Reswell",
  description: "Real-time marketplace signals and operational monitoring for Reswell staff.",
  path: "/admin/live",
})

export default function AdminLiveLayout({ children }: { children: ReactNode }) {
  return children
}
