import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { MessagesOffersPageClient } from "@/components/features/messages/messages-offers-page-client"
import { MessagesOffersPageSkeleton } from "@/components/features/messages/messages-page-skeletons"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Offers — Reswell",
  description: "View and respond to active offers on your listings and purchases.",
  path: "/messages/offers",
})

export default async function MessagesOffersPage() {
  const { user } = await getCachedRequestSession()

  if (!user) {
    redirect("/auth/login?redirect=/messages/offers")
  }

  return (
    <Suspense fallback={<MessagesOffersPageSkeleton />}>
      <MessagesOffersPageClient userId={user.id} />
    </Suspense>
  )
}
