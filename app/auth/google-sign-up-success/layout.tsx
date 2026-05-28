import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { GOOGLE_SIGN_UP_SUCCESS_PATH } from "@/lib/google-ads/sign-up-success-path"

export const metadata = privatePageMetadata({
  title: "Welcome to Reswell",
  description: "Your Reswell account is ready. Browse, buy, and sell surf gear.",
  path: GOOGLE_SIGN_UP_SUCCESS_PATH,
})

export default function GoogleSignUpSuccessLayout({ children }: { children: ReactNode }) {
  return children
}
