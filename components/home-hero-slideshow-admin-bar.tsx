"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getAdminSession } from "@/app/actions/account"

/** Matches `public.images` rows returned by GET /api/admin/home-hero-slides */
type AdminHeroSlideRow = { id: string; url: string; sort_order: number }

const HERO_IMAGE_MAX = 15 * 1024 * 1024

const plusButtonClass = "h-10 w-10 shrink-0 rounded-full shadow-soft"

/**
 * Admin-only: one + control opens a panel backed by `public.images` (scope `home_hero`).
 * Upload goes to `site-assets`; rows are inserted via POST /api/admin/home-hero-slides.
 */
export function HomeHeroSlideshowAdminBar() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [slides, setSlides] = React.useState<AdminHeroSlideRow[]>([])
  const [loadingList, setLoadingList] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let cancelled = false
    getAdminSession()
      .then((d: { isAdmin?: boolean }) => {
        if (!cancelled) {
          setIsAdmin(d.isAdmin === true)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadSlides = React.useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch("/api/admin/home-hero-slides", { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { slides: AdminHeroSlideRow[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load slides")
        return
      }
      setSlides(Array.isArray(json.data?.slides) ? json.data!.slides : [])
    } finally {
      setLoadingList(false)
    }
  }, [])

  React.useEffect(() => {
    if (dialogOpen) void loadSlides()
  }, [dialogOpen, loadSlides])

  async function uploadHeroFile(file: File): Promise<string | null> {
    if (file.size > HERO_IMAGE_MAX) {
      toast.error("Image must be under 15MB")
      return null
    }
    const supabase = createClient()
    const ext = (file.name.split(".").pop() || "png").toLowerCase()
    const safeExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "jpg"
    const path = `hero/${crypto.randomUUID()}.${safeExt}`
    const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: false })
    if (error) {
      console.error(error)
      toast.error(error.message || "Upload failed")
      return null
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("site-assets").getPublicUrl(path)
    return `${publicUrl}?t=${Date.now()}`
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (!file) return

    setBusy(true)
    try {
      const url = await uploadHeroFile(file)
      if (!url) return

      const res = await fetch("/api/admin/home-hero-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image_url: url }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not add slide")
        return
      }
      toast.success("Hero image added")
      router.refresh()
      void loadSlides()
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/home-hero-slides/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not remove slide")
        return
      }
      toast.success("Image removed from slideshow")
      setSlides((prev) => prev.filter((s) => s.id !== id))
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  if (!loaded || !isAdmin) return null

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onFileChange}
      />

      <Button
        type="button"
        size="icon"
        variant="default"
        className={plusButtonClass}
        onClick={() => setDialogOpen(true)}
        aria-label="Homepage hero images"
      >
        <Plus className="h-5 w-5" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Homepage hero images</DialogTitle>
            <DialogDescription>
              Slides come from the Supabase <code className="text-xs">images</code> table. While there is at least one
              row, the hero uses <strong>only</strong> those URLs (same order as here). If you remove every row, the
              eight default static slides return.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add image
                </>
              )}
            </Button>

            {loadingList ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : slides.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No extra slides yet. Add an image to store it in the database and show it on the homepage.
              </p>
            ) : (
              <ScrollArea className="max-h-[min(360px,50vh)] pr-3">
                <ul className="space-y-3">
                  {slides.map((slide) => (
                    <li
                      key={slide.id}
                      className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/30 p-2 pr-2"
                    >
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                        <Image
                          src={slide.url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="96px"
                          unoptimized={slide.url.startsWith("/")}
                        />
                      </div>
                      <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                        <span className="line-clamp-2 break-all font-mono">{slide.url}</span>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deletingId === slide.id}
                        onClick={() => void onDelete(slide.id)}
                        aria-label="Remove from slideshow"
                      >
                        {deletingId === slide.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
