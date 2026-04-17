import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Authentication error — Reswell",
  description: "Something went wrong during sign-in. Return to Reswell and try again.",
  path: "/auth/error",
})

export default function AuthErrorLayout({ children }: { children: ReactNode }) {
  return children
}
