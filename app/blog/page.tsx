import { BlogCmsFloatingPanel } from "@/components/features/admin/blog/blog-cms-panel"
import { ReadingHub } from "@/components/field-notes/reading-hub"
import { createClient } from "@/lib/supabase/server"
import { listPublishedArticlesForSite } from "@/lib/services/blogPublic"
import { resolveBlogAdminAccess } from "@/lib/services/blogAdminGate"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = pageSeoMetadata({
  title: "Blog — Reswell",
  description:
    "Field notes from Reswell—practical guides on gear, culture, and the marketplace, for anyone who buys, sells, or lives out of a board bag.",
  path: "/blog",
})

export default async function BlogPage() {
  const supabase = await createClient()
  const articles = await listPublishedArticlesForSite(supabase)
  const { canManageBlogCms } = await resolveBlogAdminAccess()

  return (
    <>
      {canManageBlogCms ? <BlogCmsFloatingPanel /> : null}
      <ReadingHub
        title="Blog"
        description="Field notes from Reswell—practical guides on gear, culture, and the marketplace, for anyone who buys, sells, or lives out of a board bag."
        articles={articles}
      />
    </>
  )
}
