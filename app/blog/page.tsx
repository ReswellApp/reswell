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
    "Stories and practical guides from Reswell on gear, culture, and the marketplace, for buyers and sellers.",
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
        description="Stories and practical guides from Reswell on gear, culture, and the marketplace, for buyers and sellers."
        articles={articles}
      />
    </>
  )
}
