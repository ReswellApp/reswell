"use client"

import { useCallback, useId, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Upload, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { createClient } from "@/lib/supabase/client"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import {
  assertListingOriginalSize,
  prepareListingImagePairFromFile,
} from "@/lib/listing-image-pipeline"
import { uploadListingImagePairToSupabase } from "@/lib/listing-image-storage"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import type { FbMarketplaceImportPreview } from "@/lib/validations/fb-marketplace-import"

type FormState = {
  sourceUrl: string
  title: string
  price: string
  description: string
  brand: string
  model: string
  dimensions: string
  condition: string
  city: string
  state: string
}

type UploadedImage = { url: string; thumbnail_url: string }

function apiQuery(accessKeyInUrl: string | null): string {
  if (!accessKeyInUrl?.trim()) return ""
  return `?key=${encodeURIComponent(accessKeyInUrl.trim())}`
}

function ImportPreviewPhoto({ url }: { url: string }) {
  const src = proxiedListingImageSrc(url) || url
  const isExternal = /^https?:\/\//i.test(src)

  if (isExternal) {
    return (
      // FB import previews use short-lived CDN URLs — plain img avoids next/image host allowlisting.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
    )
  }

  return <Image src={src} alt="" fill className="object-cover" sizes="120px" />
}

export default function ImportListingClient({
  isSignedIn,
  accessKeyInUrl,
}: {
  isSignedIn: boolean
  accessKeyInUrl: string | null
}) {
  const router = useRouter()
  const signIn = useSignInGate()
  const fileInputId = useId()
  const supabase = useMemo(() => createClient(), [])

  const [fbUrl, setFbUrl] = useState("")
  const [importing, setImporting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [preview, setPreview] = useState<FbMarketplaceImportPreview | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [importedImageUrls, setImportedImageUrls] = useState<string[]>([])
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  const [form, setForm] = useState<FormState>({
    sourceUrl: "",
    title: "",
    price: "",
    description: "",
    brand: "",
    model: "",
    dimensions: "",
    condition: "",
    city: "",
    state: "",
  })

  const formRef = useRef(form)
  formRef.current = form

  const patchForm = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  async function handleImport() {
    const url = fbUrl.trim()
    if (!url) {
      toast.error("Paste your Facebook Marketplace link first.")
      return
    }

    setImporting(true)
    try {
      const res = await fetch(`/api/import/fb-marketplace/preview${apiQuery(accessKeyInUrl)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const json = (await res.json()) as {
        data?: FbMarketplaceImportPreview
        error?: string
      }

      if (!res.ok || !json.data) {
        toast.error(json.error ?? "Could not import that listing.")
        return
      }

      setManualMode(false)

      const data = json.data
      setPreview(data)
      setImportedImageUrls(data.imageUrls)
      setUploadedImages([])
      patchForm({
        sourceUrl: data.sourceUrl,
        title: data.title,
        price: data.price != null ? String(data.price) : "",
        description: data.description,
        brand: data.brand,
        model: data.model,
        dimensions: data.dimensions,
        condition: data.condition,
        city: data.city,
        state: data.state,
      })

      if (data.warnings.length > 0) {
        toast.message("Imported with a few gaps", {
          description: data.warnings.slice(0, 2).join(" "),
        })
      } else {
        toast.success("Listing imported — review and publish when ready.")
      }
    } catch {
      toast.error("Import failed. Try again in a moment.")
    } finally {
      setImporting(false)
    }
  }

  async function handleAddPhotos(files: FileList | null) {
    if (!files?.length) return
    if (!isSignedIn) {
      signIn("/import/listing")
      return
    }

    setUploadingPhotos(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token || !session.user) {
        signIn("/import/listing")
        return
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !anonKey) {
        toast.error("Upload is not configured.")
        return
      }

      const added: UploadedImage[] = []
      for (const file of Array.from(files)) {
        try {
          assertListingOriginalSize(file)
          const prepared = await prepareListingImagePairFromFile(file)
          const uploaded = await uploadListingImagePairToSupabase({
            supabaseUrl,
            accessToken: session.access_token,
            anonKey,
            userId: session.user.id,
            clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            prepared,
          })
          added.push({ url: uploaded.fullUrl, thumbnail_url: uploaded.thumbUrl })
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Photo upload failed.")
        }
      }

      if (added.length > 0) {
        setUploadedImages((prev) => [...prev, ...added])
        toast.success(added.length === 1 ? "Photo added" : `${added.length} photos added`)
      }
    } finally {
      setUploadingPhotos(false)
    }
  }

  async function handlePublish() {
    if (!isSignedIn) {
      signIn("/import/listing")
      return
    }

    const current = formRef.current
    if (!current.sourceUrl.trim()) {
      toast.error("Import a Facebook listing first.")
      return
    }
    if (!current.title.trim()) {
      toast.error("Title is required.")
      return
    }
    if (!current.price.trim()) {
      toast.error("Price is required.")
      return
    }
    if (!current.condition) {
      toast.error("Select a condition.")
      return
    }
    if (!current.city.trim() || !current.state.trim()) {
      toast.error("City and state are required.")
      return
    }
    if (importedImageUrls.length + uploadedImages.length === 0) {
      toast.error("Add at least one photo.")
      return
    }

    setPublishing(true)
    try {
      const res = await fetch(`/api/import/fb-marketplace/publish${apiQuery(accessKeyInUrl)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: current.sourceUrl,
          title: current.title,
          price: current.price,
          description: current.description,
          brand: current.brand,
          model: current.model,
          dimensions: current.dimensions,
          condition: current.condition,
          city: current.city,
          state: current.state,
          importedImageUrls,
          uploadedImages,
        }),
      })
      const json = (await res.json()) as {
        data?: { listingId: string; slug: string }
        error?: string
      }

      if (!res.ok || !json.data) {
        toast.error(json.error ?? "Publish failed.")
        return
      }

      toast.success("Your listing is live on Reswell.")
      router.push(listingDetailHref({ id: json.data.listingId, slug: json.data.slug }))
    } catch {
      toast.error("Publish failed. Try again.")
    } finally {
      setPublishing(false)
    }
  }

  const previewImages = [
    ...importedImageUrls.map((url) => ({ url, imported: true })),
    ...uploadedImages.map((img) => ({ url: img.thumbnail_url || img.url, imported: false })),
  ]

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/60">
          Quick import
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          List from Facebook Marketplace
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Paste your Marketplace link, tweak anything we missed, and publish on Reswell in one step.
          Pickup only for now — you can edit shipping later from your dashboard.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Paste your link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="fb-url">Facebook Marketplace URL</Label>
            <Input
              id="fb-url"
              type="url"
              inputMode="url"
              placeholder="https://www.facebook.com/marketplace/item/…"
              value={fbUrl}
              onChange={(e) => setFbUrl(e.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void handleImport()} disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Importing…
              </>
            ) : (
              "Import listing"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              const sourceUrl = fbUrl.trim() || "https://www.facebook.com/marketplace/"
              setManualMode(true)
              setPreview({
                sourceUrl,
                listingId: "",
                title: "",
                price: null,
                description: "",
                brand: "",
                model: "",
                dimensions: "",
                condition: "",
                city: "",
                state: "",
                imageUrls: [],
                warnings: ["Fill in the details below manually."],
              })
              patchForm({
                sourceUrl,
                title: "",
                price: "",
                description: "",
                brand: "",
                model: "",
                dimensions: "",
                condition: "",
                city: "",
                state: "",
              })
              setImportedImageUrls([])
              setUploadedImages([])
            }}
          >
            Skip import — fill manually
          </Button>
        </CardContent>
      </Card>

      {preview || manualMode ? (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Review & publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {preview.warnings.length > 0 ? (
              <ul className="space-y-1 rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="import-title">Title</Label>
                <Input
                  id="import-title"
                  value={form.title}
                  onChange={(e) => patchForm({ title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-price">Price (USD)</Label>
                <Input
                  id="import-price"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => patchForm({ price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-condition">Condition</Label>
                <Select
                  value={form.condition || "__unset__"}
                  onValueChange={(v) => patchForm({ condition: v === "__unset__" ? "" : v })}
                >
                  <SelectTrigger id="import-condition">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset__">Select condition</SelectItem>
                    {LISTING_CONDITION_SELL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-brand">Brand</Label>
                <Input
                  id="import-brand"
                  value={form.brand}
                  onChange={(e) => patchForm({ brand: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-model">Model</Label>
                <Input
                  id="import-model"
                  value={form.model}
                  onChange={(e) => patchForm({ model: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="import-dimensions">Dimensions</Label>
                <Input
                  id="import-dimensions"
                  placeholder={`e.g. 6'2" x 19.5" x 2.5"`}
                  value={form.dimensions}
                  onChange={(e) => patchForm({ dimensions: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-city">City</Label>
                <Input
                  id="import-city"
                  value={form.city}
                  onChange={(e) => patchForm({ city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-state">State</Label>
                <Input
                  id="import-state"
                  value={form.state}
                  onChange={(e) => patchForm({ state: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="import-description">Description</Label>
                <Textarea
                  id="import-description"
                  rows={5}
                  value={form.description}
                  onChange={(e) => patchForm({ description: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Photos</Label>
                <div>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      void handleAddPhotos(e.target.files)
                      e.target.value = ""
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingPhotos}
                    onClick={() => document.getElementById(fileInputId)?.click()}
                  >
                    {uploadingPhotos ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" aria-hidden />
                    )}
                    Add photos
                  </Button>
                </div>
              </div>
              {previewImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {previewImages.map((img, i) => (
                    <div
                      key={`${img.url}-${i}`}
                      className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                    >
                      <ImportPreviewPhoto url={img.url} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No photos yet — add at least one before publishing.
                </p>
              )}
            </div>

            {form.sourceUrl ? (
              <p className="text-xs text-muted-foreground">
                Source:{" "}
                <a
                  href={form.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline"
                >
                  Facebook listing
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </p>
            ) : null}

            {!isSignedIn ? (
              <p className="text-sm text-muted-foreground">
                You&apos;ll need to{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline"
                  onClick={() => signIn("/import/listing")}
                >
                  sign in
                </button>{" "}
                to publish.
              </p>
            ) : null}

            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              disabled={publishing}
              onClick={() => void handlePublish()}
            >
              {publishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Publishing…
                </>
              ) : (
                "Publish on Reswell"
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <p className="mt-8 text-center text-xs text-muted-foreground/70">
        Prefer the full sell flow?{" "}
        <Link href="/sell" className="text-primary underline">
          List manually
        </Link>
      </p>
    </main>
  )
}
