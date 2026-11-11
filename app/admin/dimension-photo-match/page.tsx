import { privatePageMetadata } from "@/lib/site-metadata"
import { DimensionPhotoMatchAdminClient } from "@/components/features/admin/dimension-photo-match/dimension-photo-match-admin-client"

export const metadata = privatePageMetadata({
  title: "Dimension photo match — Reswell admin",
  description:
    "Train and review surfboard dimension photo matching. Ratings are indexed and retrieved into the next vision call (Good / Close / Bad / Exclude).",
  path: "/admin/dimension-photo-match",
})

export default function AdminDimensionPhotoMatchPage() {
  return (
    <>
      <h1 className="sr-only">Dimension photo match</h1>
      <DimensionPhotoMatchAdminClient />
    </>
  )
}
