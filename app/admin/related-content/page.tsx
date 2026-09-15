import { privatePageMetadata } from "@/lib/site-metadata"
import { RelatedContentAdminClient } from "@/components/features/admin/related-content/related-content-admin-client"

export const metadata = privatePageMetadata({
  title: "Related content — Admin",
  description: "Match blog posts and listings to listing pages.",
  path: "/admin/related-content",
})

export default function AdminRelatedContentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Related content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Attach blog posts and other listings to a listing page. Shoppers see them in the related
          content strip on <span className="font-medium">/l</span> — unpublished blogs and hidden
          listings stay off the public page until they go live.
        </p>
      </div>
      <RelatedContentAdminClient />
    </div>
  )
}
