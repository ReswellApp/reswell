import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Users — Admin — Reswell",
  description: "Search Reswell accounts, roles, and moderation actions for marketplace users.",
  path: "/admin/users",
})

export default function AdminUsersLayout({ children }: { children: ReactNode }) {
  return children
}
