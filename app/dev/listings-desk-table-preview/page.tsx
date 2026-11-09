import { notFound } from "next/navigation"
import { ListingsDeskTablePreview } from "./preview"

export default function ListingsDeskTablePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <ListingsDeskTablePreview />
}
