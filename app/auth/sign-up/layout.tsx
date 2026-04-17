import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Create account — Reswell",
  description: "Join Reswell to list your surfboard, message buyers, and shop used and new surf gear.",
  path: "/auth/sign-up",
})

export default function AuthSignUpLayout({ children }: { children: ReactNode }) {
  return children
}
