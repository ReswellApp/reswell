import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Choose new password — Reswell",
  description: "Set a new password for your Reswell account after verifying your reset link.",
  path: "/auth/update-password",
})

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
