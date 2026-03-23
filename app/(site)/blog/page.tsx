import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Field notes",
  description: "Stories, guides, and updates from Reswell.",
}

export default function BlogPage() {
  return (
    <main className="flex-1">
      <div className="container mx-auto max-w-2xl py-16 px-4">
        <h1 className="text-3xl font-bold text-foreground">Field notes</h1>
        <p className="mt-4 text-muted-foreground">
          Stories, guides, and updates from Reswell. More posts are coming soon.
        </p>
        <p className="mt-8">
          <Link href="/" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}
