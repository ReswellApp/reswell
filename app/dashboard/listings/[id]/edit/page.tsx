import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { fetchOwnedPeerListingEditPath } from "@/lib/db/peerListingEditPath"

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Edit listing — Reswell",
    description: "Listing editor opens on the Sell flow — redirecting you to continue editing your listing.",
    path: `/dashboard/listings/${id}/edit`,
  })
}

export default async function DashboardListingEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user } = await getCachedDashboardSession()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/dashboard/listings/${id}/edit`)}`)
  }

  const editPath = await fetchOwnedPeerListingEditPath(id, user.id)
  redirect(editPath ?? "/dashboard/listings")
}
