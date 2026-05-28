import type { ReactNode } from "react"
import { Suspense } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Welcome to Reswell",
  description: "Finishing setting up your Reswell account.",
  path: "/auth/sign-up-success",
})

export default function AuthSignUpSuccessLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>
}
