import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Messages — Reswell",
  description: "Open your inbox to reply to buyers and sellers about surfboard listings and offers.",
  path: "/messages",
})

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return children
}
