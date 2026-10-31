import { privatePageMetadata } from "@/lib/site-metadata"
import { DimensionPhotoMatchAdminClient } from "@/components/features/admin/dimension-photo-match/dimension-photo-match-admin-client"

export const metadata = privatePageMetadata({
  title: "Dimension photo match — Reswell admin",
  description:
    "Train and review surfboard dimension photo matching (length × width × thickness only). Rate Good / Close / Bad so the vision model learns from labeled listing photos.",
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
