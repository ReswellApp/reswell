'use client'

import * as React from "react"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { BlogImageDropZone } from "@/components/features/admin/blog/blog-image-drop-zone"
import type { ArticleBlock } from "@/lib/field-notes-articles"
import type { FieldNoteArticle } from "@/lib/field-notes-articles"
import { BlogTitleCover } from "@/components/field-notes/blog-title-cover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type BlockRow = { cid: string; block: ArticleBlock }

type Draft = {
  slug: string
  title: string
  deck: string
  excerpt: string
  author: string
  publishedAt: string
  readMinutes: number
  tag: string
  coverImage: string
  seoTitle: string
  seoDescription: string
  ogImage: string
  published: boolean
  /** When true and published, post appears on `/blog` index. */
  listedOnBlog: boolean
  sortOrder: string
}

function emptyDraft(): Draft {
  return {
    slug: `draft-${Date.now()}`,
    title: "",
    deck: "",
    excerpt: "",
    author: "Reswell",
    publishedAt: new Date().toISOString().slice(0, 10),
    readMinutes: 5,
    tag: "News",
    coverImage: "",
    seoTitle: "",
    seoDescription: "",
    ogImage: "",
    published: false,
    listedOnBlog: true,
    sortOrder: "",
  }
}

function packPayload(draft: Draft, blocks: ArticleBlock[]) {
  return {
    slug: draft.slug.trim(),
    title: draft.title.trim(),
    deck: draft.deck.trim(),
    excerpt: draft.excerpt.trim(),
    author: draft.author.trim(),
    publishedAt: draft.publishedAt,
    readMinutes: Number(draft.readMinutes),
    tag: draft.tag.trim(),
    coverImage: draft.coverImage.trim() || undefined,
    blocks,
    seoTitle: draft.seoTitle.trim() || undefined,
    seoDescription: draft.seoDescription.trim() || undefined,
    ogImage: draft.ogImage.trim() || undefined,
    published: draft.published,
    listedOnBlog: draft.listedOnBlog,
    ...(draft.sortOrder.trim() === "" ? {} : { sortOrder: Number(draft.sortOrder) }),
  }
}

function articleToDraft(a: FieldNoteArticle): Draft {
  return {
    slug: a.slug,
    title: a.title,
    deck: a.deck,
    excerpt: a.excerpt,
    author: a.author,
    publishedAt: a.publishedAt.slice(0, 10),
    readMinutes: a.readMinutes,
    tag: a.tag,
    coverImage: a.coverImage ?? "",
    seoTitle: a.seoTitle ?? "",
    seoDescription: a.seoDescription ?? "",
    ogImage: a.ogImage ?? "",
    published: Boolean(a.published),
    listedOnBlog: a.listedOnBlog !== false,
    sortOrder: typeof a.sortOrder === "number" ? String(a.sortOrder) : "",
  }
}

function blocksToRows(blocks: ArticleBlock[]): BlockRow[] {
  return blocks.map((block) => ({ cid: crypto.randomUUID(), block }))
}

async function fetchJson(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? undefined)
  if (init?.body !== undefined && init.body !== null) {
    headers.set("Content-Type", "application/json")
  }
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers,
  })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const err =
    typeof body === "object" && body !== null && "error" in body ? String((body as { error: unknown }).error) : ""
  return { ok: res.ok, status: res.status, body, err }
}

function extractNewBlogId(payload: unknown): string | undefined {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    typeof (payload as { data?: { id?: string } }).data?.id !== "string"
  ) {
    return undefined
  }
  return (payload as { data: { id: string } }).data.id
}

function SortablePostRow(props: {
  article: FieldNoteArticle
  active: boolean
  onPick: () => void
  working: boolean
  onDelete: () => void
  onHide: () => void
  onShowOnBlog: () => void
  onArchive: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.article.id ?? "__no_id__",
    disabled: !props.article.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : undefined,
  }
  const published = Boolean(props.article.published)
  const listedOnBlog = props.article.listedOnBlog !== false
  const statusLabel = published
    ? listedOnBlog
      ? "Live"
      : "Hidden"
    : listedOnBlog
      ? "Draft"
      : "Archived"
  const statusVariant =
    published && listedOnBlog ? "secondary" : published && !listedOnBlog ? "outline" : "outline"
  const canHide = published && listedOnBlog
  const canShowOnBlog = published && !listedOnBlog
  const canArchive = published

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex gap-2 rounded-lg border bg-card p-2", props.active && "border-primary")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn(
          "mt-1 shrink-0 touch-none text-muted-foreground",
          !props.article.id ? "opacity-40" : "hover:text-foreground",
        )}
        aria-label="Drag to reorder"
        disabled={!props.article.id}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className="min-w-0 flex-1 text-left text-sm leading-snug" onClick={props.onPick}>
        <span className="line-clamp-2 font-semibold text-foreground">{props.article.title || "(Untitled)"}</span>
        <span className="mt-1 block truncate text-muted-foreground">/{props.article.slug}</span>
      </button>
      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
        <Badge className="self-end sm:self-auto" variant={statusVariant}>
          {statusLabel}
        </Badge>
        <div className="flex flex-wrap justify-end gap-1">
          {canHide ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={props.working}
              className="h-8 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                props.onHide()
              }}
            >
              Hide
            </Button>
          ) : null}
          {canShowOnBlog ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={props.working}
              className="h-8 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                props.onShowOnBlog()
              }}
            >
              Show on blog
            </Button>
          ) : null}
          {canArchive ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={props.working}
              className="h-8 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                props.onArchive()
              }}
            >
              Archive
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={props.working || !props.article.id}
            className="h-8 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              props.onDelete()
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

function SortableBlockRow(props: {
  row: BlockRow
  patch: (cid: string, next: ArticleBlock) => void
  removeRow: (cid: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.row.cid,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : undefined,
  }
  const block = props.row.block

  return (
    <div ref={setNodeRef} style={style} className="space-y-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-2 shrink-0 touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label="Drag block"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={block.kind}
              onValueChange={(kind) => {
                if (kind === "h2") props.patch(props.row.cid, { kind: "h2", text: block.kind === "h2" ? block.text : "" })
                if (kind === "p") props.patch(props.row.cid, { kind: "p", text: block.kind === "p" ? block.text : "" })
                if (kind === "image") {
                  const prev = block.kind === "image" ? block.url : ""
                  props.patch(props.row.cid, {
                    kind: "image",
                    url: prev && /^https:\/\//i.test(prev) ? prev : "",
                    alt: block.kind === "image" ? block.alt ?? "" : "",
                    caption: block.kind === "image" ? block.caption ?? "" : "",
                    width: block.kind === "image" ? block.width : undefined,
                    height: block.kind === "image" ? block.height : undefined,
                  })
                }
                if (kind === "instagram") {
                  const prevIg = block.kind === "instagram" ? block.url : ""
                  props.patch(props.row.cid, {
                    kind: "instagram",
                    url:
                      prevIg.trim() ||
                      "https://www.instagram.com/reel/example-placeholder-replace-me/",
                  })
                }
              }}
            >
              <SelectTrigger className="h-9 w-[150px]" aria-label="Block type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="h2">Heading</SelectItem>
                <SelectItem value="p">Paragraph</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove block"
              onClick={() => props.removeRow(props.row.cid)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {block.kind === "h2" ? (
            <Input
              value={block.text}
              onChange={(e) => props.patch(props.row.cid, { kind: "h2", text: e.target.value })}
              placeholder="Heading text"
            />
          ) : null}
          {block.kind === "p" ? (
            <Textarea
              value={block.text}
              onChange={(e) => props.patch(props.row.cid, { kind: "p", text: e.target.value })}
              rows={6}
              placeholder="Paragraph…"
              className="min-h-[120px]"
            />
          ) : null}
          {block.kind === "image" ? (
            <div className="grid gap-3">
              <BlogImageDropZone
                compact
                label="Image"
                value={block.url}
                onUrlChange={(u, dim) =>
                  props.patch(props.row.cid, {
                    ...block,
                    url: u,
                    width: dim?.width,
                    height: dim?.height,
                  })
                }
                hint="Unsplash, Pexels, Pixabay, Wikimedia Commons, or a photo you own. No brand or product-catalog shots."
              />
              <Input
                value={block.alt ?? ""}
                onChange={(e) => props.patch(props.row.cid, { ...block, alt: e.target.value })}
                placeholder="Alt text (recommended)"
              />
              <Input
                value={block.caption ?? ""}
                onChange={(e) => props.patch(props.row.cid, { ...block, caption: e.target.value })}
                placeholder="Caption (optional)"
              />
            </div>
          ) : null}
          {block.kind === "instagram" ? (
            <Input
              value={block.url}
              onChange={(e) => props.patch(props.row.cid, { kind: "instagram", url: e.target.value })}
              placeholder="Instagram post or reel URL"
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

type ViewMode = "list" | "edit"

export function BlogCmsFloatingPanel() {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [working, setWorking] = React.useState(false)
  const [articles, setArticles] = React.useState<FieldNoteArticle[]>([])
  const [mode, setMode] = React.useState<ViewMode>("list")
  const [draft, setDraft] = React.useState<Draft>(() => emptyDraft())
  const [blockRows, setBlockRows] = React.useState<BlockRow[]>(() => blocksToRows([{ kind: "h2", text: "" }, { kind: "p", text: "" }]))
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined)
  /** True until first save persists a new draft. */
  const [creating, setCreating] = React.useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const reorderablePosts = articles.filter((a) => !!a.id)
  const postIds = reorderablePosts.map((a) => a.id!) as string[]

  async function reload() {
    setLoading(true)
    const { ok, body } = await fetchJson("/api/admin/blog-posts")
    setLoading(false)
    if (!ok || typeof body !== "object" || !body) {
      toast.error("Could not load blog posts")
      return
    }
    const list = (body as { data?: { articles?: FieldNoteArticle[] } }).data?.articles ?? []
    setArticles(Array.isArray(list) ? list : [])
  }

  React.useEffect(() => {
    if (open) {
      void reload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when panel opens
  }, [open])

  function resetToCreate() {
    setMode("edit")
    setCreating(true)
    setEditingId(undefined)
    setDraft(emptyDraft())
    setBlockRows(blocksToRows([{ kind: "h2", text: "Introduction" }, { kind: "p", text: "" }]))
  }

  function startEdit(id: string) {
    const a = articles.find((x) => x.id === id)
    if (!a) return
    setMode("edit")
    setCreating(false)
    setEditingId(id)
    setDraft(articleToDraft(a))
    setBlockRows(blocksToRows(a.blocks))
  }

  function backToList() {
    setMode("list")
    setEditingId(undefined)
    setCreating(false)
  }

  function patchBlock(cid: string, next: ArticleBlock) {
    setBlockRows((rows) => rows.map((r) => (r.cid === cid ? { ...r, block: next } : r)))
  }

  function removeBlock(cid: string) {
    setBlockRows((rows) => rows.filter((r) => r.cid !== cid))
  }

  async function persist() {
    const blocks = blockRows.map((r) => r.block)
    const payload = packPayload(draft, blocks)
    const isNew = creating || !editingId

    setWorking(true)
    const res = isNew
      ? await fetchJson("/api/admin/blog-posts", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      : await fetchJson(`/api/admin/blog-posts/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
    setWorking(false)

    if (!res.ok) {
      toast.error(res.err || `Save failed (${res.status})`)
      return
    }
    toast.success("Saved")
    if (isNew) {
      const newId = extractNewBlogId(res.body)
      if (newId) setEditingId(newId)
      setCreating(false)
    }
    await reload()
  }

  async function deleteCurrent() {
    if (!editingId || creating) return
    if (!confirm("Delete this article? This cannot be undone.")) return
    setWorking(true)
    const res = await fetchJson(`/api/admin/blog-posts/${editingId}`, { method: "DELETE" })
    setWorking(false)
    if (!res.ok) {
      toast.error(res.err || "Could not delete")
      return
    }
    toast.success("Deleted")
    backToList()
    await reload()
  }

  async function deletePostFromList(id: string) {
    if (!confirm("Delete this article? This cannot be undone.")) return
    setWorking(true)
    const res = await fetchJson(`/api/admin/blog-posts/${id}`, { method: "DELETE" })
    setWorking(false)
    if (!res.ok) {
      toast.error(res.err || "Could not delete")
      return
    }
    toast.success("Deleted")
    if (editingId === id) backToList()
    await reload()
  }

  async function postListingAction(id: string, action: "hide" | "show" | "archive") {
    if (action === "archive") {
      if (!confirm("Archive this post? It will leave the /blog index and the URL will return “not found” until you publish again."))
        return
    }
    setWorking(true)
    const res = await fetchJson(`/api/admin/blog-posts/${id}/visibility`, {
      method: "POST",
      body: JSON.stringify({ action }),
    })
    setWorking(false)
    if (!res.ok) {
      toast.error(res.err || "Could not update post")
      return
    }
    toast.success(action === "hide" ? "Hidden from blog index" : action === "show" ? "Shown on blog index" : "Archived")
    await reload()
  }

  async function onPostsDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    if (!over?.id || active.id === over.id) return

    const oldIndex = postIds.indexOf(String(active.id))
    const newIndex = postIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return

    const reorderedRows = arrayMove(reorderablePosts, oldIndex, newIndex)
    const nextIds = reorderedRows.map((a) => a.id!)
    setArticles((prev) => {
      const head = prev.filter((a): a is FieldNoteArticle & { id: string } => typeof a.id === "string")
      const tail = prev.filter((a) => !a.id)
      const nextHead = arrayMove(head, oldIndex, newIndex)
      return [...nextHead, ...tail]
    })

    const patch = await fetchJson("/api/admin/blog-posts/reorder", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: nextIds }),
    })

    if (!patch.ok) {
      toast.error("Reorder failed — restoring list")
      await reload()
      return
    }
    toast.success("Order saved")
    await reload()
  }

  function onBlocksDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    if (!over?.id || active.id === over.id) return
    const ids = blockRows.map((r) => r.cid)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    setBlockRows((rows) => arrayMove(rows, oldIndex, newIndex))
  }

  // Page-anchored FAB (parent must be `relative`): stays in the blog content column and under the global sticky nav (`z-50`).
  // When the sheet opens, fade the trigger so it does not sit above the sheet overlay (`z-50`).
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-10 sm:right-5 sm:top-5 md:right-8 md:top-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            size="icon"
            className={cn(
              "pointer-events-auto h-11 w-11 rounded-full shadow-lg",
              open && "pointer-events-none opacity-0",
            )}
            aria-label="Open blog CMS"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex h-full max-h-screen w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl">
          <SheetHeader className="shrink-0 border-b px-6 py-5 text-left">
            <SheetTitle>Blog CMS</SheetTitle>
            <SheetDescription>
              Manage posts on `/blog`. Covers are optional (a title card is generated when empty). Images must be
              copyright-free.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-10 pt-4">
            {mode === "list" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={resetToCreate}>
                    New post
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => reload()}>
                    Refresh
                  </Button>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </div>
                ) : (
                  <>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onPostsDragEnd}>
                      <SortableContext items={postIds} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-2">
                          {reorderablePosts.map((a) => (
                            <SortablePostRow
                              key={a.id}
                              article={a}
                              active={a.id === editingId}
                              working={working}
                              onPick={() => a.id && startEdit(a.id)}
                              onDelete={() => a.id && deletePostFromList(a.id)}
                              onHide={() => a.id && postListingAction(a.id, "hide")}
                              onShowOnBlog={() => a.id && postListingAction(a.id, "show")}
                              onArchive={() => a.id && postListingAction(a.id, "archive")}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                    {reorderablePosts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No posts yet —{" "}
                        <button type="button" className="font-medium underline" onClick={resetToCreate}>
                          create one
                        </button>
                        .
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Tip: Drag the ⋮⋮ grip to reorder the blog index.</p>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={backToList}>
                    ← All posts
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="blog_slug">Blog URL slug</Label>
                    <Input
                      id="blog_slug"
                      value={draft.slug}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          slug: e.target.value.trim().toLowerCase().replace(/\s+/g, "-"),
                        }))
                      }
                      spellCheck={false}
                      placeholder="your-post-slug"
                    />
                    <p className="text-xs text-muted-foreground">Displayed at `/blog/[slug]` — lowercase letters, numbers, hyphen.</p>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="blog_title">Title</Label>
                    <Input id="blog_title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="blog_deck">Deck</Label>
                    <Textarea id="blog_deck" rows={3} value={draft.deck} onChange={(e) => setDraft((d) => ({ ...d, deck: e.target.value }))} />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="blog_excerpt">SEO / excerpt</Label>
                    <Textarea id="blog_excerpt" rows={4} value={draft.excerpt} onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="blog_author">Author</Label>
                    <Input id="blog_author" value={draft.author} onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="blog_tag">Tag</Label>
                    <Input id="blog_tag" value={draft.tag} onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="blog_published_at">Publish date</Label>
                    <Input
                      id="blog_published_at"
                      type="date"
                      value={draft.publishedAt}
                      onChange={(e) => setDraft((d) => ({ ...d, publishedAt: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="blog_read_mins">Read time (minutes)</Label>
                    <Input
                      id="blog_read_mins"
                      type="number"
                      min={1}
                      max={480}
                      value={draft.readMinutes}
                      onChange={(e) => setDraft((d) => ({ ...d, readMinutes: Number(e.target.value) }))}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <BlogImageDropZone
                      label="Cover image (optional)"
                      value={draft.coverImage}
                      onUrlChange={(next) => setDraft((d) => ({ ...d, coverImage: next }))}
                      hint="Leave empty to use a generated title card. Copyright-free images only — Unsplash, Pexels, Pixabay, Wikimedia Commons, or photos you own."
                    />
                    {!draft.coverImage.trim() ? (
                      <div className="overflow-hidden rounded-lg border border-border">
                        <div className="relative aspect-[16/10] w-full">
                          <div className="absolute inset-0">
                            <BlogTitleCover
                              title={draft.title.trim() || "Untitled post"}
                              tag={draft.tag.trim() || "Blog"}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border p-4 sm:col-span-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={draft.published}
                        onCheckedChange={(v) => setDraft((d) => ({ ...d, published: !!v }))}
                        id="blog_published"
                      />
                      <Label htmlFor="blog_published" className="text-sm leading-none">
                        Published (URL can be live)
                      </Label>
                    </div>
                    {draft.published ? (
                      <div className="flex items-center gap-3 border-t pt-3">
                        <Switch
                          checked={draft.listedOnBlog}
                          onCheckedChange={(v) => setDraft((d) => ({ ...d, listedOnBlog: !!v }))}
                          id="blog_listed"
                        />
                        <Label htmlFor="blog_listed" className="text-sm leading-none">
                          Show on `/blog` index
                        </Label>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="blog_sort_manual">Manual sort weight (optional)</Label>
                    <Input
                      id="blog_sort_manual"
                      placeholder="Higher appears first — leave blank to auto"
                      value={draft.sortOrder}
                      onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                    />
                  </div>

                  <Accordion type="multiple" className="sm:col-span-2">
                    <AccordionItem value="seo">
                      <AccordionTrigger className="text-sm">Advanced SEO metadata</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="seo_title">SEO title override</Label>
                          <Input
                            id="seo_title"
                            value={draft.seoTitle}
                            onChange={(e) => setDraft((d) => ({ ...d, seoTitle: e.target.value }))}
                            placeholder="Defaults to headline"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="seo_desc">SEO description override</Label>
                          <Textarea
                            id="seo_desc"
                            rows={4}
                            value={draft.seoDescription}
                            onChange={(e) => setDraft((d) => ({ ...d, seoDescription: e.target.value }))}
                          />
                        </div>
                        <BlogImageDropZone
                          label="Social share image (Open Graph)"
                          value={draft.ogImage}
                          onUrlChange={(next) => setDraft((d) => ({ ...d, ogImage: next }))}
                          hint="Optional. If empty, shares use the cover photo or the generated title card. Same copyright-free rules as covers."
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>Body blocks</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setBlockRows((rows) => [
                            ...rows,
                            { cid: crypto.randomUUID(), block: { kind: "p", text: "" } },
                          ])
                        }
                      >
                        Add block
                      </Button>
                    </div>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBlocksDragEnd}>
                      <SortableContext items={blockRows.map((r) => r.cid)} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-2">
                          {blockRows.map((row) => (
                            <SortableBlockRow key={row.cid} row={row} patch={patchBlock} removeRow={removeBlock} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Saving confirms every image is copyright-free or owned by Reswell. Cover may be empty — the title
                    card is used instead.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={working} onClick={() => persist()}>
                      {working ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Saving…
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button type="button" variant="destructive" disabled={working || !editingId || creating} onClick={deleteCurrent}>
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
