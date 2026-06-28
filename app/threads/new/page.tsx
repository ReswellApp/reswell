import type { Metadata } from "next"
import { pageSeoMetadata } from "@/lib/site-metadata"
import { NewThreadPageClient } from "./new-thread-page-client"

export const metadata: Metadata = pageSeoMetadata({
  title: "New thread · Reswell",
  description: "Start a new discussion in Threads — questions, gear talk, and community topics.",
  path: "/threads/new",
  robots: { index: false, follow: false },
})

export default function NewThreadPage() {
  return <NewThreadPageClient />
}
