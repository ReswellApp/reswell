import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { AUTH_COMPLETING_PATH } from "@/lib/auth/build-auth-completing-url"

export const metadata = privatePageMetadata({
  title: "Completing sign in — Reswell",
  description: "Finishing your Reswell sign-in.",
  path: AUTH_COMPLETING_PATH,
})

export default function AuthCompletingLayout({ children }: { children: ReactNode }) {
  return children
}
