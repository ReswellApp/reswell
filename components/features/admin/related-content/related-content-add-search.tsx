"use client"

import { Check, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RelatedContentThumb } from "@/components/features/admin/related-content/related-content-thumb"
import type {
  BlogSearchHit,
  ListingSearchHit,
} from "@/components/features/admin/related-content/related-content-admin-types"

export function RelatedContentAddSearch({
  addTab,
  onAddTabChange,
  query,
  onQueryChange,
  searching,
  listingHits,
  blogHits,
  addingId,
  onAddListing,
  onAddBlog,
}: {
  addTab: "blog" | "listing"
  onAddTabChange: (tab: "blog" | "listing") => void
  query: string
  onQueryChange: (value: string) => void
  searching: boolean
  listingHits: ListingSearchHit[]
  blogHits: BlogSearchHit[]
  addingId: string | null
  onAddListing: (listingId: string) => void
  onAddBlog: (blogPostId: string) => void
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">Add related content</h3>
      <Tabs value={addTab} onValueChange={(value) => onAddTabChange(value === "listing" ? "listing" : "blog")}>
        <TabsList>
          <TabsTrigger value="blog">Blogs</TabsTrigger>
          <TabsTrigger value="listing">Listings</TabsTrigger>
        </TabsList>
        <div className="mt-3">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={addTab === "blog" ? "Search blog posts…" : "Search listings…"}
            aria-label={addTab === "blog" ? "Search blog posts" : "Search listings"}
          />
        </div>
        <TabsContent value="blog" className="mt-3">
          <HitList
            loading={searching}
            emptyLabel="No blog posts found."
            items={blogHits.map((hit) => ({
              id: hit.id,
              title: hit.title,
              meta: `${hit.published ? "Published" : "Draft"}${hit.listed_on_blog ? "" : " · unlisted"}`,
              image: hit.cover_image_url,
              already: hit.already_curated,
            }))}
            addingId={addingId}
            onAdd={onAddBlog}
          />
        </TabsContent>
        <TabsContent value="listing" className="mt-3">
          <HitList
            loading={searching}
            emptyLabel="No listings found."
            items={listingHits.map((hit) => ({
              id: hit.id,
              title: hit.title,
              meta: `${hit.section ?? "listing"}${hit.status ? ` · ${hit.status}` : ""}${hit.hidden_from_site ? " · hidden" : ""}`,
              image: hit.primary_image_url,
              already: hit.already_curated,
            }))}
            addingId={addingId}
            onAdd={onAddListing}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}

function HitList({
  loading,
  emptyLabel,
  items,
  addingId,
  onAdd,
}: {
  loading: boolean
  emptyLabel: string
  items: Array<{ id: string; title: string; meta: string; image: string | null; already: boolean }>
  addingId: string | null
  onAdd: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
      </div>
    )
  }
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <ul className="max-h-[360px] space-y-1 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
          <RelatedContentThumb src={item.image} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.meta}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={item.already ? "secondary" : "outline"}
            disabled={item.already || addingId === item.id}
            onClick={() => onAdd(item.id)}
          >
            {addingId === item.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : item.already ? (
              <Check className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </li>
      ))}
    </ul>
  )
}
