import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Edit listing — Reswell",
    description: "Listing editor opens on the Sell flow — redirecting you to continue editing your board.",
    path: `/dashboard/listings/${id}/edit`,
  })
}

export default async function DashboardListingEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/sell?edit=${id}`)
}
