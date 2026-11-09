import { notFound } from "next/navigation"
import { ThreadCardsPreview } from "./preview"

export default function ThreadCardsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <ThreadCardsPreview />
}
