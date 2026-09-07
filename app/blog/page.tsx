import { BlogCmsFloatingPanel } from "@/components/features/admin/blog/blog-cms-panel"
import { ReadingHub } from "@/components/field-notes/reading-hub"
import { createClient } from "@/lib/supabase/server"
import { listPublishedArticlesForSite } from "@/lib/services/blogPublic"
import { resolveBlogAdminAccess } from "@/lib/services/blogAdminGate"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata() {
  return resolvePageMetadata("blog")
}

export default async function BlogPage() {
  const supabase = await createClient()
  const articles = await listPublishedArticlesForSite(supabase)
  const { canManageBlogCms } = await resolveBlogAdminAccess()

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {canManageBlogCms ? <BlogCmsFloatingPanel /> : null}
      <ReadingHub
        title="Blog"
        description="Boards, fins, and the people who ride them."
        articles={articles}
      />
    </div>
  )
}
