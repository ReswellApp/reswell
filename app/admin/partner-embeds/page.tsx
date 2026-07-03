import { privatePageMetadata } from "@/lib/site-metadata"
import { PartnerEmbedsAdminPanel } from "@/components/features/admin/partner-embeds/partner-embeds-admin-panel"

export const metadata = privatePageMetadata({
  title: "Partner embeds — Admin",
  description: "Curate surfboard listings for partner-site iframe banners.",
  path: "/admin/partner-embeds",
})

export default function AdminPartnerEmbedsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Partner embeds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage listing banners that partner websites embed on their pages.
        </p>
      </div>
      <PartnerEmbedsAdminPanel />
    </div>
  )
}
