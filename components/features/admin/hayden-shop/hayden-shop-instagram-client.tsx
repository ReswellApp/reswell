"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Images,
  Instagram,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { AdminPageHeader } from "@/components/features/admin/admin-page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { INSTAGRAM_CAPTION_MAX } from "@/lib/instagram-post/build-caption"
import type {
  HaydenShopInstagramListingPack,
  HaydenShopInstagramListingPreview,
} from "@/lib/services/haydenShopInstagramPost"
import { cn } from "@/lib/utils"

type ShopInfo = {
  name: string
  seller_slug: string | null
}

export function HaydenShopInstagramClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const listingIdFromUrl = searchParams.get("listingId")?.trim() || null

  const [shop, setShop] = useState<ShopInfo | null>(null)
  const [listings, setListings] = useState<HaydenShopInstagramListingPreview[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(listingIdFromUrl)
  const [pack, setPack] = useState<HaydenShopInstagramListingPack | null>(null)
  const [loadingPack, setLoadingPack] = useState(false)
  const [caption, setCaption] = useState("")
  const [copied, setCopied] = useState(false)

  const loadList = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const res = await fetch("/api/admin/hayden-shop/instagram/listings", {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { shop: ShopInfo; listings: HaydenShopInstagramListingPreview[] }
        error?: string
      }
      if (!res.ok || !json.data) {
        setListError(typeof json.error === "string" ? json.error : "Could not load listings")
        setListings([])
        return
      }
      setShop(json.data.shop)
      setListings(json.data.listings)
    } catch {
      setListError("Could not load listings")
      setListings([])
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const loadPack = useCallback(async (listingId: string) => {
    setLoadingPack(true)
    try {
      const res = await fetch(
        `/api/admin/hayden-shop/instagram/listings/${encodeURIComponent(listingId)}`,
        { credentials: "include" },
      )
      const json = (await res.json().catch(() => ({}))) as {
        data?: { listing: HaydenShopInstagramListingPack }
        error?: string
      }
      if (!res.ok || !json.data) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load listing")
        setPack(null)
        return
      }
      setPack(json.data.listing)
      setCaption(json.data.listing.caption)
      setCopied(false)
    } finally {
      setLoadingPack(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setPack(null)
      setCaption("")
      return
    }
    void loadPack(selectedId)
  }, [selectedId, loadPack])

  function selectListing(id: string) {
    setSelectedId(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set("listingId", id)
    router.replace(`/admin/hayden-shop?${params.toString()}`, { scroll: false })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return listings
    return listings.filter((listing) => {
      const hay = [listing.title, listing.section_label, listing.price_label].join(" ").toLowerCase()
      return hay.includes(q)
    })
  }, [listings, query])

  const copyCaption = useCallback(async () => {
    const text = caption.trim()
    if (!text) {
      toast.error("Nothing to copy yet")
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Caption copied")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy")
    }
  }, [caption])

  const captionDirty = pack != null && caption !== pack.caption
  const overLimit = caption.length > INSTAGRAM_CAPTION_MAX

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Hayden's Shop"
        description="Build an Instagram post from a live listing — download every photo, then copy the details and description."
        breadcrumbs={[
          { label: "Admin", href: "/admin/home" },
          { label: "Hayden's Shop" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">1. Pick a listing</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {shop?.name ?? "Hayden Garfield Shop"}
                {shop?.seller_slug ? (
                  <>
                    {" · "}
                    <Link
                      href={`/sellers/${encodeURIComponent(shop.seller_slug)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      View shop
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void loadList()}>
              Refresh
            </Button>
          </div>

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or category"
            className="mt-4"
          />

          {loadingList ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : listError ? (
            <p className="mt-6 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-4 py-10 text-center text-sm text-destructive">
              {listError}
            </p>
          ) : filtered.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              {listings.length === 0
                ? "No live Hayden's Shop listings right now."
                : "No listings match that search."}
            </p>
          ) : (
            <ul className="mt-4 max-h-[70vh] divide-y divide-border/60 overflow-y-auto rounded-lg border border-border/70">
              {filtered.map((listing) => {
                const selected = listing.id === selectedId
                return (
                  <li key={listing.id}>
                    <button
                      type="button"
                      onClick={() => selectListing(listing.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        selected ? "bg-slate-100 dark:bg-muted" : "hover:bg-muted/50",
                      )}
                    >
                      {listing.thumbnail_url ? (
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted">
                          <Image
                            src={listing.thumbnail_url}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                            unoptimized={listingImageShouldBypassOptimization(listing.thumbnail_url)}
                          />
                        </span>
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted text-[10px] text-muted-foreground">
                          No photo
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-medium text-foreground">
                          {listing.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {listing.price_label} · {listing.section_label}
                          {listing.image_count > 0
                            ? ` · ${listing.image_count} photo${listing.image_count === 1 ? "" : "s"}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Instagram className="h-4 w-4" aria-hidden />
                2. Build the post
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Download the photos, then copy the caption into Instagram.
              </p>
            </div>
            {pack ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={pack.listing_path} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open listing
                </Link>
              </Button>
            ) : null}
          </div>

          {!selectedId ? (
            <div className="mt-8 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-16 text-center">
              <Images className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a listing to build its Instagram post.</p>
            </div>
          ) : loadingPack && !pack ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pack ? (
            <div className="mt-5 space-y-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">
                    Photos
                    <span className="ml-2 font-normal text-muted-foreground">
                      {pack.photos.length === 0
                        ? "None yet"
                        : `${pack.photos.length} downloadable`}
                    </span>
                  </h3>
                  {pack.photos.length > 0 ? (
                    <Button type="button" size="sm" asChild>
                      <a href={`/api/admin/hayden-shop/instagram/listings/${pack.id}/photos`}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download all photos
                      </a>
                    </Button>
                  ) : null}
                </div>

                {pack.photos.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">This listing has no photos.</p>
                ) : (
                  <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {pack.photos.map((photo) => (
                      <li
                        key={photo.index}
                        className="overflow-hidden rounded-xl border border-border/70 bg-muted/20"
                      >
                        <div className="relative aspect-square bg-muted">
                          {photo.preview_url ? (
                            <Image
                              src={photo.preview_url}
                              alt={`${pack.title} photo ${photo.index + 1}`}
                              fill
                              sizes="(max-width: 640px) 50vw, 240px"
                              className="object-cover"
                              unoptimized={listingImageShouldBypassOptimization(photo.preview_url)}
                            />
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                          <span className="text-xs text-muted-foreground">
                            Photo {photo.index + 1}
                          </span>
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" asChild>
                            <a href={photo.download_path}>
                              <Download className="mr-1 h-3.5 w-3.5" />
                              Save
                            </a>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">Caption</h3>
                  <div className="flex flex-wrap gap-2">
                    {captionDirty ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCaption(pack.caption)
                          setCopied(false)
                        }}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Reset
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" onClick={() => void copyCaption()}>
                      {copied ? (
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {copied ? "Copied" : "Copy caption"}
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={caption}
                  onChange={(event) => {
                    setCaption(event.target.value)
                    setCopied(false)
                  }}
                  rows={18}
                  className="mt-3 min-h-[22rem] font-mono text-sm leading-relaxed"
                  spellCheck
                />
                <p
                  className={cn(
                    "mt-2 text-xs",
                    overLimit ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {caption.length.toLocaleString()} / {INSTAGRAM_CAPTION_MAX.toLocaleString()} characters
                  {overLimit ? " — Instagram will cut this off" : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Could not load this listing.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
