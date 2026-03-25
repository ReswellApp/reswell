import type { Metadata } from "next"
import { ReadingHub } from "@/components/field-notes/reading-hub"
import { DirectoryExplorer } from "@/components/index-directory/directory-explorer"
import { getFieldNotesSorted } from "@/lib/field-notes-articles"
import { getDirectoryListEntries } from "@/lib/index-directory/registry"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Index",
  description:
    "Directory of surf brands, shapers, and storefronts — plus Field notes articles on Reswell.",
}

export default function IndexPage() {
  const articles = getFieldNotesSorted()
  const directoryEntries = getDirectoryListEntries()

  return (
    <main className="flex-1">
      <div className="border-b border-border/80 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
            Index
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Discover who makes what you ride, then settle in with longer reads from Field notes.
          </p>
        </div>
      </div>

      <DirectoryExplorer entries={directoryEntries} />

      <ReadingHub
        wrapper="div"
        title="Field notes"
        description="Stories and guides worth sitting down with — gear, community, and life around the water."
        articles={articles}
      />
    </main>
  )
}
