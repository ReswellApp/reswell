import { privatePageMetadata } from "@/lib/site-metadata"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { createClient } from "@/lib/supabase/server"
import { buildSiteAssetsInventory } from "@/lib/services/siteAssetsInventory"
import { SiteAssetsClient } from "@/components/features/admin/site-assets/site-assets-client"

export const metadata = privatePageMetadata({
  title: "Site assets — Admin — Reswell",
  description: "Visual inventory of hardcoded and CMS site imagery with storefront page references.",
  path: "/admin/site-assets",
})

export const dynamic = "force-dynamic"

export default async function AdminSiteAssetsPage() {
  const supabase = await createClient()
  const inventory = await buildSiteAssetsInventory(supabase)
  const siteOrigin = publicSiteOrigin()
  const generatedAtLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  }).format(new Date(inventory.generatedAt))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Site assets</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Visual inventory of marketing, help center, blog, press, SEO, and brand imagery — excluding
          seller listing photos. Each card links to the storefront pages where the asset appears.
          Static files live in{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-xs">public/images/</code>; blog
          images come from the CMS bucket.
        </p>
      </div>
      <SiteAssetsClient
        inventory={inventory}
        siteOrigin={siteOrigin}
        generatedAtLabel={generatedAtLabel}
      />
    </div>
  )
}
