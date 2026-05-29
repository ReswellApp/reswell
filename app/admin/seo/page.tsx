import { privatePageMetadata } from "@/lib/site-metadata"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { createClient } from "@/lib/supabase/server"
import { listManagedPageSeoService } from "@/lib/services/pageSeoAdmin"
import { getSeoSettingsService } from "@/lib/services/seoSettings"
import { SeoAdminClient } from "@/components/features/admin/seo/seo-admin-client"

export const metadata = privatePageMetadata({
  title: "SEO — Admin — Reswell",
  description: "Edit titles, descriptions, social cards, and indexing across the pages that matter.",
  path: "/admin/seo",
})

export default async function AdminSeoPage() {
  const supabase = await createClient()
  const [items, settings] = await Promise.all([
    listManagedPageSeoService(supabase),
    getSeoSettingsService(supabase),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SEO</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One place to manage search and social metadata for every page that matters. Edits override
          the page defaults instantly — clear a page to fall back.
        </p>
      </div>
      <SeoAdminClient
        initialItems={items}
        siteOrigin={publicSiteOrigin()}
        initialFaviconUrl={settings.faviconUrl}
      />
    </div>
  )
}
