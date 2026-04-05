import type { Metadata } from "next"
import { getFieldNotesSorted } from "@/lib/field-notes-articles"
import { ReadingHub } from "@/components/field-notes/reading-hub"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Field notes",
  description: "Stories, guides, and updates from Reswell.",
}

export default function BlogPage() {
  const articles = getFieldNotesSorted()

  return (
    <ReadingHub
      title="Field notes"
      description="Longer reads on gear, travel, and the people who keep surf culture moving."
      articles={articles}
    />
  )
}
