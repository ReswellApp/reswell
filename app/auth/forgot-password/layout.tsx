import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Reset password — Reswell",
  description: "Request a link to reset your Reswell account password.",
  path: "/auth/forgot-password",
})

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
