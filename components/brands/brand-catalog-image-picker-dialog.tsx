"use client"

import * as React from "react"
import Image from "next/image"
import * as Dialog from "@radix-ui/react-dialog"
import { Images, Loader2, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type PickerItem = {
  image_url: string
  source_lines: string[]
  is_focus_model: boolean
  sort_model_name: string
}

export function BrandCatalogImagePickerDialog({
  open,
  onOpenChange,
  brandId,
  focusBrandModelId,
  title = "Choose from catalog",
  onSelected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  brandId: string
  focusBrandModelId?: string | null
  title?: string
  onSelected: (imageUrl: string) => void
}) {
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<PickerItem[]>([])
  const [query, setQuery] = React.useState("")

  React.useEffect(() => {
    if (!open || !brandId) return
    setQuery("")
    setLoading(true)
    const u = new URL("/api/admin/brand-catalog-images", window.location.origin)
    u.searchParams.set("brand_id", brandId)
    if (focusBrandModelId?.trim()) {
      u.searchParams.set("focus_brand_model_id", focusBrandModelId.trim())
    }
    void fetch(u.toString(), { credentials: "include" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          data?: { items?: PickerItem[] }
          error?: string
        }
        if (!res.ok) {
          toast.error(typeof json.error === "string" ? json.error : "Could not load images")
          setItems([])
          return
        }
        setItems(json.data?.items ?? [])
      })
      .catch(() => {
        toast.error("Could not load images")
        setItems([])
      })
      .finally(() => setLoading(false))
  }, [open, brandId, focusBrandModelId])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const blob = [it.sort_model_name, ...it.source_lines, it.image_url].join(" ").toLowerCase()
      return blob.includes(q)
    })
  }, [items, query])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[100] touch-none bg-black/80",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <Dialog.Content
          data-brand-catalog-image-picker
          className={cn(
            "fixed left-[50%] top-[50%] z-[101] grid max-h-[min(90dvh,720px)] w-[min(100vw-1.5rem,42rem)] translate-x-[-50%] translate-y-[-50%]",
            "gap-0 overflow-hidden rounded-xl border bg-background p-0 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="border-b border-border/60 px-4 pb-3 pt-4 sm:px-5">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                Hero and variant photos already saved for this brand. Same image may appear once when used in multiple
                places.
              </DialogDescription>
            </DialogHeader>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by model or size…"
                className="h-9 pl-9 text-sm"
                aria-label="Filter catalog images"
              />
            </div>
          </div>

          <ScrollArea className="h-[min(52dvh,420px)] sm:h-[min(48dvh,400px)]">
            <div className="p-3 sm:p-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-7 w-7 animate-spin opacity-60" />
                  Loading catalog…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center text-sm text-muted-foreground">
                  <Images className="h-10 w-10 opacity-40" />
                  {items.length === 0 ? (
                    <p>No photos in the catalog for this brand yet. Upload images on models or variants first.</p>
                  ) : (
                    <p>No matches. Try a different search.</p>
                  )}
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {filtered.map((it) => (
                    <li key={it.image_url}>
                      <button
                        type="button"
                        className={cn(
                          "group w-full overflow-hidden rounded-lg border border-border/60 bg-card text-left shadow-sm ring-offset-background transition hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          it.is_focus_model && "ring-2 ring-primary/20",
                        )}
                        onClick={() => {
                          onSelected(it.image_url)
                          onOpenChange(false)
                        }}
                      >
                        <span className="relative block aspect-square w-full bg-muted">
                          <Image
                            src={it.image_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width:640px) 45vw, 140px"
                          />
                        </span>
                        <span className="block space-y-0.5 p-2">
                          <span className="line-clamp-2 text-[11px] font-medium leading-snug text-foreground">
                            {it.source_lines[0]}
                          </span>
                          {it.source_lines.length > 1 ? (
                            <span className="line-clamp-2 text-[10px] text-muted-foreground">
                              +{it.source_lines.length - 1} more use{it.source_lines.length === 2 ? "" : "s"}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="border-t border-border/60 px-4 py-3 sm:px-5">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>

          <Dialog.Close className="absolute right-3 top-3 rounded-sm p-1.5 text-muted-foreground opacity-80 ring-offset-background transition hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function BrandCatalogImagePickButton({
  brandId,
  disabled,
  focusBrandModelId,
  title,
  label = "Pick from catalog",
  onSelected,
  size = "sm",
  className,
}: {
  brandId: string
  disabled?: boolean
  focusBrandModelId?: string | null
  title?: string
  label?: string
  onSelected: (imageUrl: string) => void
  size?: "sm" | "default"
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size={size}
        className={cn("gap-1.5", className)}
        disabled={disabled || !brandId}
        onClick={() => setOpen(true)}
      >
        <Images className="h-3.5 w-3.5" />
        {label}
      </Button>
      <BrandCatalogImagePickerDialog
        open={open}
        onOpenChange={setOpen}
        brandId={brandId}
        focusBrandModelId={focusBrandModelId}
        title={title}
        onSelected={onSelected}
      />
    </>
  )
}
