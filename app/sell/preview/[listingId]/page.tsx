import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SurfboardListingDetailPage } from "@/components/surfboard-listing-detail-page"
import { UsedListingDetailPage } from "@/components/used-listing-detail-page"
import { SellListingPreviewToolbar } from "@/components/sell-listing-preview-toolbar"

export const metadata: Metadata = {
  title: "Preview listing — Reswell",
  robots: { index: false, follow: false },
}

export default async function SellListingPreviewPage(props: {
  params: Promise<{ listingId: string }>
}) {
  const { listingId } = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=/sell/preview/${listingId}`)
  }

  const { data: row, error } = await supabase
    .from("listings")
    .select("id, user_id, status, section")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !row) {
    notFound()
  }

  if (row.user_id !== user.id) {
    notFound()
  }

  if (row.status !== "draft") {
    redirect(`/l/${listingId}`)
  }

  const section = row.section as string

  return (
    <div className="flex min-h-screen flex-col">
      <SellListingPreviewToolbar listingId={listingId} />
      {section === "surfboards" ? (
        <SurfboardListingDetailPage listingParam={listingId} />
      ) : section === "used" ? (
        <UsedListingDetailPage listing={listingId} />
      ) : (
        notFound()
      )}
    </div>
  )
}
