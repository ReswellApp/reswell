import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Check your email — Reswell",
  description: "Confirm your email address to finish creating your Reswell account.",
  path: "/auth/sign-up-success",
})

export default function AuthSignUpSuccessLayout({ children }: { children: ReactNode }) {
  return children
}
