import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Sign in — Reswell",
  description: "Log in to your Reswell account to buy surfboards, message sellers, and manage listings.",
  path: "/auth/login",
})

export default function AuthLoginLayout({ children }: { children: ReactNode }) {
  return children
}
