"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { RelatedContentThumb } from "@/components/features/admin/related-content/related-content-thumb"
import type { BlogSearchHit } from "@/components/features/admin/related-content/related-content-admin-types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { ListingAdminBarSnapshot } from "@/lib/listing-detail-admin-bar"

const SEARCH_DEBOUNCE_MS = 220

export function ListingDetailAdminRelatedBlogDialog({
  listing,
  open,
  onOpenChange,
}: {
  listing: ListingAdminBarSnapshot
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [hits, setHits] = React.useState<BlogSearchHit[]>([])
  const [searching, setSearching] = React.useState(false)
  const [addingId, setAddingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      setSearching(true)
      const params = new URLSearchParams({ type: "blog", q: query, host_listing_id: listing.id })
      void fetch(`/api/admin/related-content/search?${params.toString()}`, { credentials: "include" })
        .then(async (res) => {
          const json = (await res.json().catch(() => ({}))) as {
            data?: { blogs?: BlogSearchHit[] }
            error?: string
          }
          if (!res.ok) {
            toast.error(typeof json.error === "string" ? json.error : "Could not search posts")
            setHits([])
            return
          }
          setHits(Array.isArray(json.data?.blogs) ? json.data.blogs : [])
        })
        .finally(() => setSearching(false))
    }, query.trim() ? SEARCH_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(handle)
  }, [listing.id, open, query])

  React.useEffect(() => {
    if (open) return
    setQuery("")
    setHits([])
    setAddingId(null)
  }, [open])

  async function attachBlog(blogPostId: string) {
    setAddingId(blogPostId)
    try {
      const res = await fetch(`/api/admin/related-content/${encodeURIComponent(listing.id)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "blog", blog_post_id: blogPostId }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not attach post")
        return
      }
      toast.success("Added to Related content")
      onOpenChange(false)
      router.refresh()
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attach a blog post</DialogTitle>
          <DialogDescription>
            It will show in Related content on this listing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blog posts…"
            aria-label="Search blog posts"
          />
          {searching ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : hits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No blog posts found.</p>
          ) : (
            <ul className="max-h-[360px] space-y-1 overflow-y-auto">
              {hits.map((hit) => (
                <li key={hit.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <RelatedContentThumb src={hit.cover_image_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{hit.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {hit.published ? "Published" : "Draft"}
                      {hit.listed_on_blog ? "" : " · unlisted"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={hit.already_curated ? "secondary" : "outline"}
                    disabled={hit.already_curated || addingId === hit.id}
                    onClick={() => void attachBlog(hit.id)}
                  >
                    {addingId === hit.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : hit.already_curated ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
