import { privatePageMetadata } from "@/lib/site-metadata"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { listManagedPageSeoReference } from "@/lib/services/pageSeoAdmin"
import { SeoAdminClient } from "@/components/features/admin/seo/seo-admin-client"

export const metadata = privatePageMetadata({
  title: "SEO — Admin — Reswell",
  description: "Reference titles, descriptions, social cards, and indexing across the pages that matter.",
  path: "/admin/seo",
})

export default function AdminSeoPage() {
  const items = listManagedPageSeoReference()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SEO</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only reference for every page that matters. Live metadata comes from{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-xs">lib/seo/managed-pages.ts</code>
          . Ask Cursor to update titles, descriptions, share images, or the site favicon in code.
        </p>
      </div>
      <SeoAdminClient initialItems={items} siteOrigin={publicSiteOrigin()} />
    </div>
  )
}
