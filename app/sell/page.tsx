"use client"

import React, { Suspense } from "react"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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
import { toast } from "sonner"
import {
  ArrowLeft,
  Upload,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import dynamic from "next/dynamic"
import { listingDetailHref } from "@/lib/listing-href"
const LocationPicker = dynamic(
  () => import("@/components/location-picker").then((m) => ({ default: m.LocationPicker })),
  {
    ssr: false,
    loading: () => <div className="h-64 rounded-lg bg-muted animate-pulse" />,
  },
)
import {
  boardFulfillmentFromFlags,
  flagsFromBoardFulfillment,
  type BoardFulfillmentChoice,
} from "@/lib/listing-fulfillment"
import { slugify } from "@/lib/slugify"
import {
  clearImpersonation,
  clearImpersonationStorageIfCookieMissing,
  getImpersonation,
  type ImpersonationData,
} from "@/lib/impersonation"
import type { IndexBoardModelSelection } from "@/components/index-board-model-combobox"
import {
  SurfboardTitleIndexInput,
  titleFromIndexModelPick,
} from "@/components/surfboard-title-index-input"
import { listingTitleWithBoardLength } from "@/lib/listing-title-board-length"
import {
  assertListingOriginalSize,
  browserCanDecodeImage as pipelineCanDecodeImage,
  prepareListingImagePairFromFile,
  type PreparedListingImagePair,
} from "@/lib/listing-image-pipeline"
import { uploadListingImagePairToSupabase } from "@/lib/listing-image-storage"
import {
  buildSellListingDraft,
  clearSellListingDraft,
  loadSellListingDraft,
  saveSellListingDraft,
  type SellListingDraftFormSnapshot,
} from "@/lib/sell-listing-draft-idb"
import { cn } from "@/lib/utils"
import { BrandInputWithSuggestions } from "@/components/brand-input-with-suggestions"
import { listingDetailPath } from "@/lib/listing-query"
import {
  validateSellListingForm,
  buildResolvedListingTitle,
  LISTING_TITLE_MAX_LENGTH,
  type SellFormValidationInput,
} from "@/lib/sell-form-validation"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"
import {
  boardDimensionDisplayFields,
  boardDimensionsToDbFields,
  formatBoardLengthForTitle,
} from "@/lib/board-measurements"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"

function submitErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (error && typeof error === "object") {
    const o = error as { message?: unknown; details?: unknown; hint?: unknown }
    if (typeof o.message === "string" && o.message.trim()) return o.message
    const parts = [o.details, o.hint].filter((x): x is string => typeof x === "string" && x.trim() !== "")
    if (parts.length) return parts.join(" — ")
  }
  return fallback
}

function SellFormSection({
  title,
  children,
  description,
}: {
  title: string
  children: React.ReactNode
  description?: string
}) {
  return (
    <section className="space-y-3 lg:space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground lg:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground mt-1 lg:text-base lg:mt-1.5">{description}</p>
        ) : null}
      </div>
      <Card className="shadow-sm hover:shadow-sm lg:shadow-md">
        <CardContent className="p-6 lg:p-8 xl:p-10">{children}</CardContent>
      </Card>
    </section>
  )
}

// Board type to category UUID mapping
const boardCategoryMap: Record<string, string> = {
  shortboard: "7e434a96-f3f7-4a73-b733-704a769195e6",
  longboard: "47a0d0bb-8738-43b4-a0fe-a5b2acc72fa3",
  funboard: "93b8eeaf-366b-4823-8bb9-98d42c5fefba",
  "step-up": "91c4e8a2-3f5b-4d1c-9e6a-7b8c9d0e1f2a",
  fish: "f3ccddc0-f0f3-45d3-ad43-51bcf9935b45",
  foamie: "7cc95cb5-2391-4e53-a48e-42977bf9504b",
  gun: "7e434a96-f3f7-4a73-b733-704a769195e6", // default to shortboard category
  other: "7e434a96-f3f7-4a73-b733-704a769195e6",
}

/** Map surfboard category row id → `board_type` enum (multiple keys can share one UUID). */
function boardTypeFromCategoryId(categoryId: string): string {
  const keys = Object.entries(boardCategoryMap)
    .filter(([, uuid]) => uuid === categoryId)
    .map(([bt]) => bt)
  if (keys.length === 0) return "other"
  if (keys.includes("shortboard")) return "shortboard"
  if (keys.includes("funboard")) return "funboard"
  if (keys.includes("step-up")) return "step-up"
  if (keys.includes("longboard")) return "longboard"
  if (keys.includes("fish")) return "fish"
  if (keys.includes("foamie")) return "foamie"
  if (keys.includes("gun")) return "gun"
  return keys[0]
}

const LISTING_UPLOAD_STEP_LABELS = [
  "Saving listing details...",
  "Publishing your listing...",
  "Almost there...",
] as const

type PublishPreviewState = {
  title: string
  price: string
  coverUrl: string
  status: "publishing" | "live" | "error"
  detailHref?: string
  errorMessage?: string
  failedStepLabel?: string
}

type ListingPhotoSlot = {
  clientId: string
  /** Local preview (blob URL) until we can show uploaded thumb */
  previewUrl: string
  id?: string
  url?: string
  thumbnailUrl?: string
  optimizePhase: "idle" | "running" | "done" | "error"
  uploadPhase: "idle" | "uploading" | "done" | "error"
  progressFull: number
  progressThumb: number
  errorMessage?: string
  sourceFile?: File
  prepared?: PreparedListingImagePair
}

/** Admin-only quick fill: portrait URLs (not re-uploaded; valid for submit validation). */
const ADMIN_SEED_IMAGE_URLS = [
  "https://picsum.photos/seed/reswell-seed-1/600/900",
  "https://picsum.photos/seed/reswell-seed-2/600/900",
  "https://picsum.photos/seed/reswell-seed-3/600/900",
] as const

function shippingPriceToFormValue(v: unknown): string {
  if (v == null || v === "") return ""
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""))
  if (!Number.isFinite(n)) return ""
  return String(n)
}

function SellPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const editId = searchParams.get("edit")

  const [impersonation, setImpersonation] = useState<ImpersonationData | null>(null)
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  useEffect(() => {
    clearImpersonationStorageIfCookieMissing()
    setImpersonation(getImpersonation())
  }, [])

  const [loading, setLoading] = useState(false)
  const [submitStepIndex, setSubmitStepIndex] = useState(0)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const [descriptionGenerated, setDescriptionGenerated] = useState(false)
  const submitStepIndexRef = useRef(0)
  const [publishPreview, setPublishPreview] = useState<PublishPreviewState | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const uploadToastIdRef = useRef<string | number | null>(null)
  const uploadPhaseLabelsRef = useRef<string[]>([...LISTING_UPLOAD_STEP_LABELS])
  const [uploadPhaseLabels, setUploadPhaseLabels] = useState<string[]>(() => [
    ...LISTING_UPLOAD_STEP_LABELS,
  ])
  const [editLoading, setEditLoading] = useState(!!editId)
  const [draftHydrated, setDraftHydrated] = useState(!!editId)

  useEffect(() => {
    if (!loading) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [loading])
  const [images, setImages] = useState<ListingPhotoSlot[]>([])
  const imagesRef = useRef<ListingPhotoSlot[]>([])
  useEffect(() => {
    imagesRef.current = images
  }, [images])
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "",
    brand: "",
    boardFulfillment: "pickup_only" as BoardFulfillmentChoice,
    boardShippingPrice: "",
    boardType: "",
    boardLengthFt: "",
    boardLengthIn: "",
    boardWidthInches: "",
    boardThicknessInches: "",
    boardVolumeL: "",
    boardFins: "",
    boardTail: "",
    /** Directory brand UUID when linked via board index (matches listings.brand_id) */
    boardBrandId: "",
    boardIndexBrandSlug: "",
    boardIndexModelSlug: "",
    boardIndexLabel: "",
    /** Catalog brand name when linked via title picker — used for “Suggested” under Brand / shaper */
    boardLinkedBrandName: "",
    locationLat: 0,
    locationLng: 0,
    locationCity: "",
    locationState: "",
    locationDisplay: "",
  })

  const [sellCategoryOptions, setSellCategoryOptions] = useState<
    { value: string; label: string; board: boolean }[]
  >([])

  const boardCategoryOptions = useMemo(
    () => sellCategoryOptions.filter((c) => c.board === true),
    [sellCategoryOptions],
  )

  const listingType = "board" as const

  const sellDraftLatestRef = useRef({
    listingType: "board" as const,
    formData: {} as SellListingDraftFormSnapshot,
    images: [] as ListingPhotoSlot[],
    editId: null as string | null,
    draftHydrated: false,
  })
  const sellDraftPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftPhotosPendingRef = useRef<ListingPhotoSlot[] | null>(null)
  const supabaseProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, board")
        .eq("board", true)
        .order("name")
      if (cancelled) return
      if (error) return
      setSellCategoryOptions(
        (data ?? []).map((r) => ({
          value: r.id,
          label: r.name ?? "",
          board: true,
        })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()
      if (!cancelled) setViewerIsAdmin(profile?.is_admin === true)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (editId || sellCategoryOptions.length === 0 || !draftHydrated) return
    setFormData((prev) => {
      if (prev.category) return prev
      const first =
        sellCategoryOptions.find((c) => c.board === true) ?? sellCategoryOptions[0]
      if (!first) return prev
      return {
        ...prev,
        category: first.value,
        boardType:
          first.board === true ? boardTypeFromCategoryId(first.value) : prev.boardType,
      }
    })
  }, [editId, sellCategoryOptions, draftHydrated])

  sellDraftLatestRef.current = {
    listingType,
    formData: formData as SellListingDraftFormSnapshot,
    images,
    editId,
    draftHydrated,
  }

  const boardLengthFormatted = useMemo(
    () => formatBoardLengthForTitle(formData.boardLengthFt, formData.boardLengthIn),
    [formData.boardLengthFt, formData.boardLengthIn],
  )

  const sellValidationForm = useMemo(
    (): SellFormValidationInput => ({
      listingType: "board",
      title: formData.title,
      price: formData.price,
      description: formData.description,
      condition: formData.condition,
      category: formData.category,
      brand: formData.brand,
      boardType: formData.boardType,
      boardLengthFt: formData.boardLengthFt,
      boardLengthIn: formData.boardLengthIn,
      boardWidthInches: formData.boardWidthInches,
      boardThicknessInches: formData.boardThicknessInches,
      boardVolumeL: formData.boardVolumeL,
      boardFins: formData.boardFins,
      boardTail: formData.boardTail,
      boardFulfillment: formData.boardFulfillment,
      boardShippingPrice: formData.boardShippingPrice,
      locationCity: formData.locationCity,
      locationState: formData.locationState,
    }),
    [formData],
  )
  const resolvedTitlePreview = useMemo(
    () => buildResolvedListingTitle(sellValidationForm),
    [sellValidationForm],
  )

  // Count completed board fields for progress indicator
  const boardFieldsCompleted = useMemo(() => {
    return [
      images.length >= 3,
      formData.title.trim(),
      formData.boardLengthFt.trim(),
      formData.boardWidthInches.trim(),
      formData.boardThicknessInches.trim(),
      formData.boardFins,
      formData.boardTail,
      formData.condition,
      formData.price.trim(),
      formData.description.trim(),
    ].filter(Boolean).length
  }, [images.length, formData.title, formData.boardLengthFt, formData.boardWidthInches, formData.boardThicknessInches, formData.boardFins, formData.boardTail, formData.condition, formData.price, formData.description])

  // When a directory model is linked from the title field, offer to snap brand back to the catalog name
  const suggestedBrand = useMemo(() => {
    const s = formData.boardLinkedBrandName.trim()
    if (!s) return null
    if (formData.brand.trim().toLowerCase() === s.toLowerCase()) return null
    return s
  }, [formData.boardLinkedBrandName, formData.brand])

  useEffect(() => {
    if (editId) {
      setDraftHydrated(true)
      return
    }
    let cancelled = false
    void (async () => {
      const draft = await loadSellListingDraft()
      if (cancelled) return
      if (!draft) {
        setDraftHydrated(true)
        return
      }
      setFormData((prev) => ({ ...prev, ...(draft.formData as Partial<typeof prev>) }))
      const restored: ListingPhotoSlot[] = []
      for (const b of draft.imageBlobs) {
        const file = new File([b.buffer], b.name, { type: b.type || "image/jpeg" })
        const clientId = crypto.randomUUID()
        restored.push({
          clientId,
          previewUrl: URL.createObjectURL(file),
          optimizePhase: "running",
          uploadPhase: "idle",
          progressFull: 0,
          progressThumb: 0,
          sourceFile: file,
        })
      }
      if (restored.length) {
        draftPhotosPendingRef.current = restored
        setImages(restored)
      }
      setDraftHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [editId])

  useEffect(() => {
    if (editId || !draftHydrated) return
    if (sellDraftPersistTimerRef.current) clearTimeout(sellDraftPersistTimerRef.current)
    sellDraftPersistTimerRef.current = setTimeout(() => {
      sellDraftPersistTimerRef.current = null
      void (async () => {
        const r = sellDraftLatestRef.current
        if (r.editId || !r.draftHydrated) return
        const built = await buildSellListingDraft(
          r.listingType,
          r.formData,
          r.images.map((i) => ({ file: i.sourceFile })),
        )
        if (built) await saveSellListingDraft(built)
        else await clearSellListingDraft()
      })()
    }, 600)
    return () => {
      if (sellDraftPersistTimerRef.current) clearTimeout(sellDraftPersistTimerRef.current)
    }
  }, [editId, draftHydrated, formData, images])

  useEffect(() => {
    const flush = () => {
      const r = sellDraftLatestRef.current
      if (r.editId || !r.draftHydrated) return
      void (async () => {
        const built = await buildSellListingDraft(
          r.listingType,
          r.formData,
          r.images.map((i) => ({ file: i.sourceFile })),
        )
        if (built) await saveSellListingDraft(built)
        else await clearSellListingDraft()
      })()
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  useEffect(() => {
    if (!editId) {
      setEditListingOwnerId(null)
      setEditLoading(false)
      return
    }
    let mounted = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setEditLoading(false)
        return
      }
      const imp = getImpersonation()
      // Use `*` so edit load works before/without dimension display columns; see
      // supabase/migrations/20260407140000_listing_dimension_display_text.sql
      let query = supabase
        .from("listings")
        .select(
          `
          *,
          listing_images (id, url, thumbnail_url, is_primary, sort_order)
        `,
        )
        .eq("id", editId)
      if (!imp) {
        query = query.eq("user_id", user.id)
      }
      const { data: listing, error } = await query.single()
      if (!mounted) return
      if (error || !listing) {
        toast.error("Listing not found or cannot be edited")
        router.replace("/sell")
        setEditLoading(false)
        return
      }
      if ((listing as { status?: string }).status === "sold") {
        toast.message("This listing has sold — it can’t be edited.")
        router.replace(
          listingDetailPath({
            section: String(listing.section),
            slug: (listing as { slug?: string | null }).slug ?? null,
            id: String(listing.id),
          }),
        )
        setEditLoading(false)
        return
      }
      if ((listing as { section?: string }).section !== "surfboards") {
        toast.error("Only surfboard listings can be edited here.")
        router.replace("/sell")
        setEditLoading(false)
        return
      }
      setEditListingOwnerId(listing.user_id as string)
      if (imp && imp.userId !== listing.user_id) {
        clearImpersonation()
        setImpersonation(null)
      }
      const lengthFeet = listing.length_feet != null ? String(listing.length_feet) : ""
      const loadedFulfillment = boardFulfillmentFromFlags(
        listing.local_pickup,
        listing.shipping_available
      )
      let boardShippingPrice = shippingPriceToFormValue(listing.shipping_price)
      if (
        (loadedFulfillment === "shipping_only" || loadedFulfillment === "pickup_and_shipping") &&
        !boardShippingPrice
      ) {
        boardShippingPrice = "0"
      }
      setFormData({
        title: listing.title ?? "",
        description: listing.description ?? "",
        price: String(listing.price ?? ""),
        category: listing.category_id ?? "",
        condition: listing.condition ?? "",
        brand: (listing as { brand?: string | null }).brand?.trim() ?? "",
        boardFulfillment: loadedFulfillment,
        boardShippingPrice,
        boardType: listing.board_type ?? "",
        boardLengthFt: lengthFeet ? lengthFeet : "",
        boardLengthIn:
          (listing as { length_inches_display?: string | null }).length_inches_display?.trim() ||
          (listing.length_inches != null && Number(listing.length_inches) !== 0
            ? String(listing.length_inches)
            : ""),
        boardWidthInches:
          (listing as { width_inches_display?: string | null }).width_inches_display?.trim() ||
          ((listing as { width?: number | null }).width != null
            ? String((listing as { width?: number | null }).width)
            : ""),
        boardThicknessInches:
          (listing as { thickness_inches_display?: string | null }).thickness_inches_display?.trim() ||
          ((listing as { thickness?: number | null }).thickness != null
            ? String((listing as { thickness?: number | null }).thickness)
            : ""),
        boardVolumeL:
          (listing as { volume_display?: string | null }).volume_display?.trim() ||
          ((listing as { volume?: number | null }).volume != null
            ? String((listing as { volume?: number | null }).volume)
            : ""),
        boardFins: (listing as { fins_setup?: string | null }).fins_setup ?? "",
        boardTail: (listing as { tail_shape?: string | null }).tail_shape ?? "",
        boardBrandId: (listing as { brand_id?: string | null }).brand_id?.trim() ?? "",
        boardIndexBrandSlug: "",
        boardIndexModelSlug: "",
        boardIndexLabel: "",
        boardLinkedBrandName:
          (listing as { brand_id?: string | null }).brand_id?.trim()
            ? ((listing as { brand?: string | null }).brand?.trim() ?? "")
            : "",
        locationLat: Number(listing.latitude) || 0,
        locationLng: Number(listing.longitude) || 0,
        locationCity: listing.city ?? "",
        locationState: listing.state ?? "",
        locationDisplay: [listing.city, listing.state].filter(Boolean).join(", ") || "",
      })
      const existingImages = (listing.listing_images || [])
        .slice()
        .sort(
          (a: any, b: any) =>
            (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
            (a.sort_order ?? 0) - (b.sort_order ?? 0)
        )
        .map((img: any) => {
          const url = img.url as string
          const tid = img.id as string
          return {
            clientId: tid,
            previewUrl: url,
            id: tid,
            url,
            thumbnailUrl: (img.thumbnail_url as string | null) || url,
            optimizePhase: "done" as const,
            uploadPhase: "done" as const,
            progressFull: 100,
            progressThumb: 100,
          }
        })
      setImages(existingImages)
      setRemovedImageIds([])
      setEditLoading(false)
    })()
    return () => { mounted = false }
  }, [editId, supabase, router])

  useEffect(() => {
    if (!draftHydrated || editId) return
    const pending = draftPhotosPendingRef.current
    if (!pending?.length) return
    draftPhotosPendingRef.current = null
    for (const s of pending) {
      void optimizeAndUploadSlot(s)
    }
  }, [draftHydrated, editId])

  /** Get image dimensions from a file (vertical = height > width). */
  function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error("Failed to load image"))
      }
      img.src = url
    })
  }

  async function convertViaServer(file: File): Promise<File> {
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/convert-image", { method: "POST", body: form })
    const ct = res.headers.get("content-type") || ""
    if (!res.ok) {
      let msg = "Server could not convert this image to JPEG"
      try {
        if (ct.includes("application/json")) {
          const j = (await res.json()) as { error?: string }
          if (j?.error) msg = j.error
        } else {
          const t = await res.text()
          if (t) msg = t.slice(0, 240)
        }
      } catch { /* ignore */ }
      throw new Error(msg)
    }
    if (!ct.includes("image/jpeg")) {
      throw new Error("Server did not return a JPEG image")
    }
    const blob = await res.blob()
    const base = file.name.replace(/\.[^.]+$/i, "") || "image"
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" })
  }

  async function toJpegIfUnsupported(file: File): Promise<File> {
    if (await pipelineCanDecodeImage(file)) return file
    return convertViaServer(file)
  }

  async function optimizeAndUploadSlot(slot: ListingPhotoSlot) {
    const clientId = slot.clientId
    const previewUrl = slot.previewUrl
    let prepared = slot.prepared

    try {
      if (!prepared) {
        const src = slot.sourceFile
        if (!src) return
        let file = await toJpegIfUnsupported(src)
        const dims = await getImageDimensions(file)
        if (dims.height <= dims.width) {
          if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
          setImages((prev) => prev.filter((s) => s.clientId !== clientId))
          toast.error(
            `"${src.name}" is not vertical. Portrait only — height must be greater than width.`,
          )
          return
        }
        prepared = await prepareListingImagePairFromFile(file)
        setImages((prev) =>
          prev.map((s) =>
            s.clientId === clientId
              ? { ...s, optimizePhase: "done", prepared, sourceFile: undefined }
              : s,
          ),
        )
      }

      if (!prepared) return

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setImages((prev) =>
          prev.map((s) =>
            s.clientId === clientId
              ? {
                  ...s,
                  uploadPhase: "error",
                  errorMessage: "Sign in to upload photos.",
                }
              : s,
          ),
        )
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setImages((prev) =>
          prev.map((s) =>
            s.clientId === clientId
              ? { ...s, uploadPhase: "error", errorMessage: "Sign in to upload photos." }
              : s,
          ),
        )
        return
      }

      setImages((prev) =>
        prev.map((s) =>
          s.clientId === clientId
            ? {
                ...s,
                uploadPhase: "uploading",
                progressFull: 0,
                progressThumb: 0,
                errorMessage: undefined,
              }
            : s,
        ),
      )

      const { fullUrl, thumbUrl } = await uploadListingImagePairToSupabase({
        supabaseUrl: supabaseProjectUrl,
        accessToken: session.access_token,
        anonKey: supabaseAnonKey,
        userId: user.id,
        clientId,
        prepared,
        onProgressFull: (loaded, total) => {
          const pct = total ? Math.round((100 * loaded) / total) : 0
          setImages((prev) =>
            prev.map((s) => (s.clientId === clientId ? { ...s, progressFull: pct } : s)),
          )
        },
        onProgressThumb: (loaded, total) => {
          const pct = total ? Math.round((100 * loaded) / total) : 0
          setImages((prev) =>
            prev.map((s) => (s.clientId === clientId ? { ...s, progressThumb: pct } : s)),
          )
        },
      })

      setImages((prev) =>
        prev.map((s) =>
          s.clientId === clientId
            ? {
                ...s,
                uploadPhase: "done",
                url: fullUrl,
                thumbnailUrl: thumbUrl,
                progressFull: 100,
                progressThumb: 100,
                prepared: undefined,
              }
            : s,
        ),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Photo processing failed"
      setImages((prev) =>
        prev.map((s) => {
          if (s.clientId !== clientId) return s
          if (s.prepared) {
            return { ...s, uploadPhase: "error", errorMessage: msg }
          }
          return {
            ...s,
            optimizePhase: "error",
            uploadPhase: "idle",
            errorMessage: msg,
          }
        }),
      )
      toast.error(msg)
    }
  }

  function retryListingPhotoUpload(clientId: string) {
    const live = imagesRef.current.find((s) => s.clientId === clientId)
    if (!live) return
    void optimizeAndUploadSlot({
      ...live,
      errorMessage: undefined,
    })
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    const newFiles = Array.from(e.target.files)
    if (images.length + newFiles.length > 12) {
      toast.error("Maximum 12 photos allowed. You have " + images.length + ".")
      e.target.value = ""
      return
    }
    for (const originalFile of newFiles) {
      try {
        assertListingOriginalSize(originalFile)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "File too large")
        continue
      }
      const clientId = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(originalFile)
      const slot: ListingPhotoSlot = {
        clientId,
        previewUrl,
        optimizePhase: "running",
        uploadPhase: "idle",
        progressFull: 0,
        progressThumb: 0,
        sourceFile: originalFile,
      }
      setImages((prev) => [...prev, slot])
      void optimizeAndUploadSlot(slot)
    }
    e.target.value = ""
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const toRemove = prev[index]
      if (toRemove?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(toRemove.previewUrl)
      }
      if (toRemove?.id) {
        setRemovedImageIds((ids) => [...ids, toRemove.id!])
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  function moveImage(index: number, delta: number) {
    setImages((prev) => {
      const newIndex = index + delta
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const copy = [...prev]
      const [item] = copy.splice(index, 1)
      copy.splice(newIndex, 0, item)
      return copy
    })
  }

  function listingImagesPayloadForApi(): { url: string; thumbnail_url: string | null }[] {
    return images.map((im) => ({
      url: im.url!,
      thumbnail_url: im.thumbnailUrl ?? null,
    }))
  }

  async function syncListingImages(listingId: string) {
    if (removedImageIds.length) {
      await supabase
        .from("listing_images")
        .delete()
        .in("id", removedImageIds)
        .eq("listing_id", listingId)
    }

    const newRows = images
      .map((img, index) => ({ img, index }))
      .filter(({ img }) => !img.id && img.url)

    const insertResults = await Promise.all(
      newRows.map(async ({ img, index }) => {
        const { data: inserted, error: insertError } = await supabase
          .from("listing_images")
          .insert({
            listing_id: listingId,
            url: img.url!,
            thumbnail_url: img.thumbnailUrl ?? null,
            is_primary: index === 0,
            sort_order: index,
          })
          .select("id")
          .single()

        if (insertError || !inserted?.id) {
          throw new Error(
            insertError?.message || `Photo ${index + 1} could not be saved to your listing.`,
          )
        }
        return { index, id: inserted.id as string }
      }),
    )

    let working = [...images]
    if (insertResults.length) {
      for (const { index, id } of insertResults) {
        working[index] = { ...working[index], id }
      }
      setImages(working)
    }

    await Promise.all(
      working.map(async (img, index) => {
        if (!img.id) return
        const { error } = await supabase
          .from("listing_images")
          .update({
            sort_order: index,
            is_primary: index === 0,
          })
          .eq("id", img.id)
          .eq("listing_id", listingId)
        if (error) {
          console.error("listing_images update:", error)
          throw new Error(`Could not update photo order (image ${index + 1}).`)
        }
      }),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const goSubmitStep = (n: number) => {
      submitStepIndexRef.current = n
      setSubmitStepIndex(n)
    }
    setLoading(true)
    goSubmitStep(0)
    uploadToastIdRef.current = null

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Please sign in to create a listing")
        router.push("/auth/login?redirect=/sell")
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      if (!accessToken) {
        toast.error("Your session expired. Please sign in again.")
        router.push("/auth/login?redirect=/sell")
        return
      }

      clearImpersonationStorageIfCookieMissing()

      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()
      const actorIsAdmin = actorProfile?.is_admin === true

      /** Only admins may use impersonation listing APIs; server also requires the HTTP cookie + target id. */
      let storedImpersonation = getImpersonation()
      if (storedImpersonation && !actorIsAdmin) {
        clearImpersonation()
        setImpersonation(null)
        storedImpersonation = null
      }
      const listingImpersonation: ImpersonationData | null =
        actorIsAdmin && storedImpersonation ? storedImpersonation : null

      const adminImpersonationEditListing = Boolean(
        editId &&
          editListingOwnerId &&
          listingImpersonation &&
          listingImpersonation.userId === editListingOwnerId &&
          user.id !== editListingOwnerId,
      )

      const submitForm = formData

      const imagesUploadReady = !images.some(
        (im) =>
          im.uploadPhase !== "done" ||
          !im.url?.trim() ||
          !im.thumbnailUrl?.trim(),
      )

      const validationMessage = validateSellListingForm(
        { listingType: "board", ...submitForm } as SellFormValidationInput,
        {
          imageCount: images.length,
          imagesUploadReady,
          adminImpersonationEdit: adminImpersonationEditListing,
        },
      )
      if (validationMessage) {
        toast.error(validationMessage)
        setLoading(false)
        return
      }

      const fd = submitForm

      const fulfillmentFlags = flagsFromBoardFulfillment(fd.boardFulfillment)

      const fulfillmentRow = {
        shipping_available: fulfillmentFlags.shipping_available,
        local_pickup: fulfillmentFlags.local_pickup,
        shipping_price: fulfillmentFlags.shipping_available
          ? (() => {
              const raw = fd.boardShippingPrice.trim()
              if (adminImpersonationEditListing && !raw) return 0
              return parseFloat(raw)
            })()
          : null,
      }

      const boardLocationLat = fd.locationLat ? fd.locationLat : null
      const boardLocationLng = fd.locationLng ? fd.locationLng : null
      const boardLocationCity = fd.locationCity.trim() || null
      const boardLocationState = fd.locationState.trim() || null

      const boardLengthFmt = formatBoardLengthForTitle(fd.boardLengthFt, fd.boardLengthIn)
      const resolvedListingTitle = boardLengthFmt
        ? listingTitleWithBoardLength(fd.title, boardLengthFmt)
        : fd.title.trim()

      const flowImpersonation = !!listingImpersonation
      if (!editId && !flowImpersonation) {
        const labels = [
          "Saving your listing...",
          "Attaching photos...",
          "Almost there...",
        ]
        uploadPhaseLabelsRef.current = labels
        setUploadPhaseLabels(labels)
      } else if (editId && !flowImpersonation) {
        const labels = [
          "Saving your listing...",
          "Saving photo changes...",
          "Almost there...",
        ]
        uploadPhaseLabelsRef.current = labels
        setUploadPhaseLabels(labels)
      } else {
        const labels = [...LISTING_UPLOAD_STEP_LABELS]
        uploadPhaseLabelsRef.current = labels
        setUploadPhaseLabels(labels)
      }

      setPublishPreview({
        title: resolvedListingTitle,
        price: fd.price,
        coverUrl:
          images[0]?.thumbnailUrl ||
          images[0]?.url ||
          images[0]?.previewUrl ||
          "/placeholder.svg",
        status: "publishing",
      })
      uploadToastIdRef.current = toast.loading("Your listing is being uploaded...", {
        duration: 600_000,
      })

      if (!editId && !flowImpersonation) {
        await new Promise((r) => setTimeout(r, 200))
      }

      let listingId = editId
      let listingSlug: string | null = null
      let usedImpersonationListingApi = false
      let impersonationSellerLabel: string | null = null

      // Generate a unique slug from the title
      async function generateUniqueSlug(title: string): Promise<string> {
        const base = slugify(title)
        const { count } = await supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("slug", base)
        if (!count) return base
        // Append incrementing suffix until unique
        for (let i = 2; i < 100; i++) {
          const candidate = `${base}-${i}`
          const { count: c } = await supabase
            .from("listings")
            .select("id", { count: "exact", head: true })
            .eq("slug", candidate)
          if (!c) return candidate
        }
        return `${base}-${Date.now()}`
      }

      if (editId) {
        if (!editListingOwnerId) {
          toast.error("Listing is still loading. Try again in a moment.")
          setLoading(false)
          return
        }
        const ownerEditsOwnListing = user.id === editListingOwnerId
        const adminImpersonatesListingOwner =
          !!listingImpersonation &&
          listingImpersonation.userId === editListingOwnerId &&
          user.id !== editListingOwnerId

        const dimDb = boardDimensionsToDbFields(fd)
        const dimDisplay = boardDimensionDisplayFields(fd)
        const editListingFields = {
          title: resolvedListingTitle,
          description: fd.description,
          price: parseFloat(fd.price),
          condition: fd.condition,
          category_id: fd.category,
          board_type: fd.boardType,
          length_feet: dimDb.length_feet,
          length_inches: dimDb.length_inches,
          width: dimDb.width,
          thickness: dimDb.thickness,
          volume: dimDb.volume,
          ...dimDisplay,
          fins_setup: fd.boardFins ? fd.boardFins : null,
          tail_shape: fd.boardTail ? fd.boardTail : null,
          latitude: boardLocationLat,
          longitude: boardLocationLng,
          city: boardLocationCity,
          state: boardLocationState,
          shipping_available: fulfillmentRow.shipping_available,
          local_pickup: fulfillmentRow.local_pickup,
          shipping_price: fulfillmentRow.shipping_price,
          brand: fd.brand.trim() ? fd.brand.trim() : null,
          brand_id: fd.boardBrandId.trim() || null,
        }

        if (ownerEditsOwnListing) {
          const updatePayload = { ...editListingFields, updated_at: new Date().toISOString() }
          let { data: updated, error: updateError } = await supabase
            .from("listings")
            .update(updatePayload)
            .eq("id", editId)
            .eq("user_id", user.id)
            .select("slug")
            .single()
          if (updateError && isListingDimensionDisplaySchemaCacheError(updateError)) {
            if (process.env.NODE_ENV === "development") {
              console.warn(
                "[sell] DB missing listing dimension display columns; saved without them. Run: supabase/migrations/20260407140000_listing_dimension_display_text.sql",
              )
            }
            const retry = await supabase
              .from("listings")
              .update({
                ...withoutListingDimensionDisplayDbFields(editListingFields as Record<string, unknown>),
                updated_at: new Date().toISOString(),
              })
              .eq("id", editId)
              .eq("user_id", user.id)
              .select("slug")
              .single()
            updated = retry.data
            updateError = retry.error
          }
          if (updateError) throw new Error(submitErrorMessage(updateError, "Failed to update listing"))
          listingSlug = updated?.slug ?? null
        } else if (adminImpersonatesListingOwner) {
          usedImpersonationListingApi = true
          goSubmitStep(0)
          const imageOps: {
            id?: string
            url?: string
            thumbnail_url?: string | null
            is_primary: boolean
            sort_order: number
          }[] = []
          for (let i = 0; i < images.length; i++) {
            const img = images[i]
            if (img.id) {
              imageOps.push({ id: img.id, is_primary: i === 0, sort_order: i })
              continue
            }
            if (!img.url?.trim() || !img.thumbnailUrl?.trim()) {
              throw new Error(`Photo ${i + 1} is still uploading. Wait or retry before saving.`)
            }
            imageOps.push({
              url: img.url,
              thumbnail_url: img.thumbnailUrl,
              is_primary: i === 0,
              sort_order: i,
            })
          }

          goSubmitStep(1)
          const res = await fetch("/api/admin/impersonate/update-listing", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              listingId: editId,
              listing: editListingFields,
              removedImageIds,
              images: imageOps,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "Failed to update listing")
          listingSlug = data.slug
          goSubmitStep(2)
          if (typeof data.seller_display_name === "string" && data.seller_display_name.trim()) {
            impersonationSellerLabel = data.seller_display_name.trim()
          }
        } else {
          toast.error(
            "This listing belongs to another account. From admin, open the seller and use impersonation for that shop, or sign in as the listing owner.",
          )
          setLoading(false)
          return
        }
      } else {
        const dimDbNew = boardDimensionsToDbFields(fd)
        const dimDisplayNew = boardDimensionDisplayFields(fd)
        const listingFields = {
          title: resolvedListingTitle,
          description: fd.description,
          price: parseFloat(fd.price),
          condition: fd.condition,
          section: "surfboards" as const,
          category_id: fd.category,
          board_type: fd.boardType,
          length_feet: dimDbNew.length_feet,
          length_inches: dimDbNew.length_inches,
          width: dimDbNew.width,
          thickness: dimDbNew.thickness,
          volume: dimDbNew.volume,
          ...dimDisplayNew,
          fins_setup: fd.boardFins ? fd.boardFins : null,
          tail_shape: fd.boardTail ? fd.boardTail : null,
          latitude: boardLocationLat,
          longitude: boardLocationLng,
          city: boardLocationCity,
          state: boardLocationState,
          shipping_available: fulfillmentRow.shipping_available,
          local_pickup: fulfillmentRow.local_pickup,
          shipping_price: fulfillmentRow.shipping_price,
          brand: fd.brand.trim() ? fd.brand.trim() : null,
          brand_id: fd.boardBrandId.trim() || null,
        }

        if (listingImpersonation) {
          usedImpersonationListingApi = true
          goSubmitStep(0)
          const imagePayload = listingImagesPayloadForApi()
          if (imagePayload.length !== images.length) {
            throw new Error("Finish uploading all photos before submitting.")
          }
          goSubmitStep(1)
          const res = await fetch("/api/admin/impersonate/create-listing", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listing: listingFields, images: imagePayload }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "Failed to create listing")
          listingId = data.listing_id
          listingSlug = data.slug
          goSubmitStep(2)
          if (typeof data.seller_display_name === "string" && data.seller_display_name.trim()) {
            impersonationSellerLabel = data.seller_display_name.trim()
          }
        } else {
          const newSlug = await generateUniqueSlug(resolvedListingTitle)
          const insertPayload = {
            user_id: user.id,
            ...listingFields,
            slug: newSlug,
            status: "active" as const,
          }
          let { data: listing, error: listingError } = await supabase
            .from("listings")
            .insert(insertPayload)
            .select()
            .single()

          if (listingError && isListingDimensionDisplaySchemaCacheError(listingError)) {
            if (process.env.NODE_ENV === "development") {
              console.warn(
                "[sell] DB missing listing dimension display columns; saved without them. Run: supabase/migrations/20260407140000_listing_dimension_display_text.sql",
              )
            }
            const retryPayload = {
              user_id: user.id,
              ...withoutListingDimensionDisplayDbFields(listingFields as Record<string, unknown>),
              slug: newSlug,
              status: "active" as const,
            }
            const retry = await supabase.from("listings").insert(retryPayload).select().single()
            listing = retry.data
            listingError = retry.error
          }

          if (listingError) {
            throw new Error(submitErrorMessage(listingError, "Failed to create listing"))
          }
          if (!listing) {
            throw new Error("No listing returned")
          }
          listingId = listing.id
          listingSlug = listing.slug ?? newSlug
          goSubmitStep(1)
          const imageRows = images.map((im, index) => ({
            listing_id: listingId,
            url: im.url!,
            thumbnail_url: im.thumbnailUrl ?? null,
            is_primary: index === 0,
            sort_order: index,
          }))
          const { error: imagesInsertError } = await supabase
            .from("listing_images")
            .insert(imageRows)
          if (imagesInsertError) {
            throw new Error(submitErrorMessage(imagesInsertError, "Failed to save listing photos"))
          }
          void fetch("/api/integrations/klaviyo/listing-created", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listing_id: listingId }),
          })
            .then(async (res) => {
              if (res.ok) return
              const text = await res.text().catch(() => "")
              if (process.env.NODE_ENV === "development") {
                console.warn(
                  "[klaviyo] listing-created API:",
                  res.status,
                  text.slice(0, 300),
                )
              }
            })
            .catch((err) => {
              if (process.env.NODE_ENV === "development") {
                console.warn("[klaviyo] listing-created fetch failed:", err)
              }
            })
          goSubmitStep(2)
        }
      }

      const detailPath =
        listingId != null
          ? listingDetailHref({
              id: listingId,
              slug: listingSlug,
              section: "surfboards",
            })
          : "/boards"

      if (listingId) {
        if (!editId && !listingImpersonation) {
          setPublishPreview((p) =>
            p ? { ...p, status: "live", detailHref: detailPath } : null,
          )
          const tid = uploadToastIdRef.current
          if (tid != null) {
            toast.success("Your listing is live! 🎉", { id: tid })
          } else {
            toast.success("Your listing is live! 🎉")
          }
          void clearSellListingDraft()
          router.push(detailPath)
          return
        }
        if (editId && !usedImpersonationListingApi) {
          const willSyncNewPhotos = images.some((im) => !im.id && im.url)
          if (willSyncNewPhotos) goSubmitStep(1)
          await syncListingImages(listingId)
          goSubmitStep(2)
        }
      }

      goSubmitStep(2)
      setPublishPreview((p) => (p ? { ...p, status: "live", detailHref: detailPath } : null))

      const tidDone = uploadToastIdRef.current
      if (impersonationSellerLabel) {
        const msg = editId
          ? `Listing updated for ${impersonationSellerLabel}`
          : `Listing created for ${impersonationSellerLabel}`
        if (tidDone != null) toast.success(`${msg} 🎉`, { id: tidDone })
        else toast.success(msg)
      } else {
        const msg = editId ? "Listing updated!" : "Your listing is live! 🎉"
        if (tidDone != null) toast.success(msg, { id: tidDone })
        else toast.success(editId ? "Listing updated!" : "Your listing is live! 🎉")
      }
      void clearSellListingDraft()
      router.push(detailPath)
    } catch (error: unknown) {
      const msg = submitErrorMessage(error, "Failed to create listing")
      console.error("Error creating listing:", msg, error)
      const failedLabel =
        uploadPhaseLabelsRef.current[submitStepIndexRef.current] ?? "This step"
      setPublishPreview((p) =>
        p
          ? {
              ...p,
              status: "error",
              errorMessage: msg,
              failedStepLabel: failedLabel,
            }
          : null,
      )
      const tid = uploadToastIdRef.current
      if (tid != null) {
        toast.error("Something went wrong. Please try again.", {
          id: tid,
          description: msg,
          action: {
            label: "Retry",
            onClick: () => formRef.current?.requestSubmit(),
          },
        })
      } else {
        toast.error(msg, {
          action: {
            label: "Retry",
            onClick: () => formRef.current?.requestSubmit(),
          },
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const stepCount = Math.max(1, uploadPhaseLabels.length)
  const listingSubmitProgressValue = Math.min(
    99,
    ((submitStepIndex + 0.35) / stepCount) * 100,
  )

  const optimizingAny = images.some((im) => im.optimizePhase === "running")

  const applyAdminSeedListing = useCallback(() => {
    const cat =
      boardCategoryOptions[0]?.value ?? boardCategoryMap.shortboard
    const boardType = boardCategoryOptions[0]
      ? boardTypeFromCategoryId(cat)
      : "shortboard"

    const seedSlots: ListingPhotoSlot[] = ADMIN_SEED_IMAGE_URLS.map((url) => ({
      clientId: crypto.randomUUID(),
      previewUrl: url,
      url,
      thumbnailUrl: url,
      optimizePhase: "done",
      uploadPhase: "done",
      progressFull: 100,
      progressThumb: 100,
    }))

    setImages((prev) => {
      for (const im of prev) {
        if (im.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(im.previewUrl)
      }
      return seedSlots
    })

    if (editId) {
      setRemovedImageIds((prev) => {
        const fromSlots = images.map((im) => im.id).filter((x): x is string => !!x)
        return [...new Set([...prev, ...fromSlots])]
      })
    } else {
      setRemovedImageIds([])
    }

    setFormData((prev) => ({
      ...prev,
      title: "Admin seed",
      description:
        "Admin seed listing for QA — shortboard placeholder. Replace copy and photos before production use.",
      price: "0.50",
      category: cat,
      condition: "good",
      brand: "Seed Brand",
      boardFulfillment: "pickup_only",
      boardShippingPrice: "",
      boardType,
      boardLengthFt: "5",
      boardLengthIn: "8",
      boardWidthInches: "19",
      boardThicknessInches: "2.375",
      boardVolumeL: "28",
      boardFins: "thruster",
      boardTail: "round",
      boardBrandId: "",
      boardIndexBrandSlug: "",
      boardIndexModelSlug: "",
      boardIndexLabel: "",
      boardLinkedBrandName: "",
      locationLat: 32.7157,
      locationLng: -117.1611,
      locationCity: "San Diego",
      locationState: "CA",
      locationDisplay: "San Diego, CA",
    }))
    toast.message("Seed listing data applied")
  }, [boardCategoryOptions, editId, images])

  return (
      <main className="flex-1 w-full bg-muted py-8">
        <div className="container mx-auto max-w-2xl lg:max-w-3xl">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>

          <div className="mb-10 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                  {editId ? "Edit listing" : "Create a Listing"}
                </h1>
                <p className="text-sm text-muted-foreground lg:text-base">
                  {editId ? "Update your listing details" : "List your surfboard for buyers on Reswell"}
                </p>
              </div>
              {viewerIsAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={
                    loading ||
                    boardCategoryOptions.length === 0 ||
                    optimizingAny
                  }
                  onClick={applyAdminSeedListing}
                >
                  Fill seed listing
                </Button>
              )}
            </div>
          </div>
          {editLoading ? (
            <div className="flex items-center justify-center py-16 rounded-xl border border-border bg-card shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="space-y-10 lg:space-y-12"
              aria-busy={loading}
            >
                <SellFormSection
                  title="Listing title & brand / shaper"
                  description="Title is shown on your listing and in the URL (max length includes board length). Brand is optional — link from the catalog or enter any name."
                >
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <div className="flex items-end justify-between gap-2">
                        <Label htmlFor="title">Title *</Label>
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            resolvedTitlePreview.length > LISTING_TITLE_MAX_LENGTH
                              ? "font-medium text-destructive"
                              : "text-muted-foreground",
                          )}
                          aria-live="polite"
                        >
                          {resolvedTitlePreview.length}/{LISTING_TITLE_MAX_LENGTH}
                        </span>
                      </div>
                      <SurfboardTitleIndexInput
                        id="title"
                        placeholder={`e.g., Channel Islands Dumpster Diver - 5'6"`}
                        value={formData.title}
                        onChange={(title) => setFormData((f) => ({ ...f, title }))}
                        boardLength={boardLengthFormatted}
                        onSelectModel={(opt: IndexBoardModelSelection) => {
                          setFormData((f) => {
                            return {
                              ...f,
                              title: titleFromIndexModelPick(opt).slice(
                                0,
                                LISTING_TITLE_MAX_LENGTH,
                              ),
                              boardBrandId: opt.brandId,
                              boardIndexBrandSlug: opt.brandSlug,
                              boardIndexModelSlug: opt.modelSlug,
                              boardIndexLabel: opt.label,
                              brand: opt.brandName,
                              boardLinkedBrandName: opt.brandName,
                            }
                          })
                        }}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="surf-brand">Brand / shaper (optional)</Label>
                      {formData.boardBrandId ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <BrandInputWithSuggestions
                                id="surf-brand"
                                showHint={false}
                                value={formData.brand}
                                onChange={(v) => setFormData({ ...formData, brand: v })}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 shrink-0 self-start text-xs text-muted-foreground"
                              onClick={() =>
                                setFormData((f) => ({
                                  ...f,
                                  boardBrandId: "",
                                  boardIndexBrandSlug: "",
                                  boardIndexModelSlug: "",
                                  boardIndexLabel: "",
                                  boardLinkedBrandName: "",
                                }))
                              }
                            >
                              Clear link
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Suggestions from our brand list — you can enter any brand.
                          </p>
                        </div>
                      ) : (
                        <BrandInputWithSuggestions
                          id="surf-brand"
                          placeholder="e.g., Channel Islands"
                          value={formData.brand}
                          onChange={(v) => setFormData({ ...formData, brand: v })}
                        />
                      )}
                      {suggestedBrand ? (
                        <p className="text-xs text-muted-foreground">
                          Suggested:{" "}
                          <span className="font-medium text-foreground">{suggestedBrand}</span>
                          {" — "}
                          <button
                            type="button"
                            className="text-primary underline-offset-2 hover:underline"
                            onClick={() => setFormData((f) => ({ ...f, brand: suggestedBrand }))}
                          >
                            Use this
                          </button>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </SellFormSection>

                <SellFormSection title="Board shape / category · fin setup & tail">
                    <div className="space-y-8">
                      <div className="space-y-2">
                        <Label>Board shape / category *</Label>
                        <Select
                          value={formData.category}
                          disabled={!!editId}
                          onValueChange={(value) => {
                            setFormData((prev) => ({
                              ...prev,
                              category: value,
                              boardType: boardTypeFromCategoryId(value),
                            }))
                          }}
                        >
                          <SelectTrigger aria-label="Board shape or category">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent>
                            {boardCategoryOptions.length === 0 ? (
                              <SelectItem value="__loading__" disabled>
                                {sellCategoryOptions.length === 0
                                  ? "Loading categories…"
                                  : "No board categories found — add rows with board = true in public.categories."}
                              </SelectItem>
                            ) : (
                              boardCategoryOptions.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {editId && (
                          <p className="text-xs text-muted-foreground">
                            Category can&apos;t be changed while editing.
                          </p>
                        )}
                        <div className="flex items-center justify-between text-sm text-muted-foreground pb-1 pt-1">
                          <span>{boardFieldsCompleted} of 10 fields complete</span>
                          <div className="flex-1 mx-3 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-300"
                              style={{ width: `${(boardFieldsCompleted / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Fin setup</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: "single", label: "Single" },
                            { value: "twin", label: "Twin (2+1)" },
                            { value: "thruster", label: "Thruster" },
                            { value: "quad", label: "Quad" },
                            { value: "five", label: "5-fin" },
                            { value: "other", label: "Other" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, boardFins: formData.boardFins === opt.value ? "" : opt.value })}
                              className={cn(
                                "rounded-full border px-3 py-1 text-sm transition-colors",
                                formData.boardFins === opt.value
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:border-primary/50",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Tail shape</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: "round", label: "Round" },
                            { value: "squash", label: "Squash" },
                            { value: "square", label: "Square" },
                            { value: "pin", label: "Pin" },
                            { value: "swallow", label: "Swallow" },
                            { value: "fish", label: "Fish" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, boardTail: formData.boardTail === opt.value ? "" : opt.value })}
                              className={cn(
                                "rounded-full border px-3 py-1 text-sm transition-colors",
                                formData.boardTail === opt.value
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:border-primary/50",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                </SellFormSection>

                <SellFormSection
                  title="Board dimensions"
                  description="Use any format you like (decimals or fractions). Volume is optional and independent of the other measurements."
                >
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {/* Length */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Length *</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder=""
                              value={formData.boardLengthFt}
                              onChange={(e) => setFormData({ ...formData, boardLengthFt: e.target.value })}
                              className="w-14 text-center px-2"
                              required
                              aria-label="Feet"
                            />
                            <span className="text-xs text-muted-foreground shrink-0">ft</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder=""
                              value={formData.boardLengthIn}
                              onChange={(e) => setFormData({ ...formData, boardLengthIn: e.target.value })}
                              className="min-w-0 flex-1 max-w-[7rem] text-center px-2"
                              aria-label="Inches"
                            />
                            <span className="text-xs text-muted-foreground shrink-0">in</span>
                          </div>
                        </div>

                        {/* Width */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Width</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder=""
                              value={formData.boardWidthInches}
                              onChange={(e) => setFormData({ ...formData, boardWidthInches: e.target.value })}
                              className="min-w-0 flex-1 max-w-[7rem] text-center px-2"
                            />
                            <span className="text-xs text-muted-foreground shrink-0">in</span>
                          </div>
                        </div>

                        {/* Thickness */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Thickness</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder=""
                              value={formData.boardThicknessInches}
                              onChange={(e) => setFormData({ ...formData, boardThicknessInches: e.target.value })}
                              className="min-w-0 flex-1 max-w-[7rem] text-center px-2"
                            />
                            <span className="text-xs text-muted-foreground shrink-0">in</span>
                          </div>
                        </div>

                        {/* Volume */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Volume</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder=""
                              value={formData.boardVolumeL}
                              onChange={(e) => setFormData({ ...formData, boardVolumeL: e.target.value })}
                              className="min-w-0 flex-1 max-w-[7rem] text-center px-2"
                            />
                            <span className="text-xs text-muted-foreground shrink-0">L</span>
                          </div>
                        </div>
                      </div>
                    </div>
                </SellFormSection>

                <SellFormSection
                  title="Pickup & shipping · where you're listing from"
                  description="Every surfboard needs a map location (pickup area or where you ship from). If you ship, set a flat shipping price (use 0 for free shipping)."
                >
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>How can buyers get this board? *</Label>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {(
                            [
                              {
                                value: "pickup_only" as const,
                                title: "Local pickup",
                                hint: "Buyer meets you",
                              },
                              {
                                value: "shipping_only" as const,
                                title: "Shipping only",
                                hint: "You ship to buyer",
                              },
                              {
                                value: "pickup_and_shipping" as const,
                                title: "Pickup or shipping",
                                hint: "Buyer chooses",
                              },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setFormData({ ...formData, boardFulfillment: opt.value })
                              }
                              className={`rounded-lg border-2 p-3 text-left text-sm transition-colors ${
                                formData.boardFulfillment === opt.value
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/40"
                              }`}
                            >
                              <p className="font-medium">{opt.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                      {(formData.boardFulfillment === "shipping_only" ||
                        formData.boardFulfillment === "pickup_and_shipping") && (
                        <div className="space-y-2">
                          <Label htmlFor="boardShippingPrice">Shipping price ($) *</Label>
                          <Input
                            id="boardShippingPrice"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00 = free shipping"
                            value={formData.boardShippingPrice}
                            onChange={(e) =>
                              setFormData({ ...formData, boardShippingPrice: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>
                    <LocationPicker
                      onLocationSelect={(loc) => {
                        setFormData({
                          ...formData,
                          locationLat: loc.lat,
                          locationLng: loc.lng,
                          locationCity: loc.city,
                          locationState: loc.state,
                          locationDisplay: loc.displayName,
                        })
                      }}
                      initialLat={formData.locationLat || undefined}
                      initialLng={formData.locationLng || undefined}
                      initialCity={formData.locationCity || undefined}
                      initialState={formData.locationState || undefined}
                      initialDisplay={formData.locationDisplay || undefined}
                    />
                  </div>
                </SellFormSection>

                <SellFormSection title="Price & condition">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price ($) *</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Condition *</Label>
                    <Select
                      value={formData.condition}
                      onValueChange={(value) => setFormData({ ...formData, condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {LISTING_CONDITION_SELL_OPTIONS.map((cond) => (
                          <SelectItem key={cond.value} value={cond.value}>
                            {cond.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                </SellFormSection>

                <SellFormSection title="Description">
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Description *
                  </Label>
                  <div className={cn(
                    "relative rounded-md transition-all",
                    isGeneratingDescription && "ring-2 ring-primary/40 ring-offset-1 animate-pulse",
                  )}>
                    <Textarea
                      id="description"
                      placeholder="Describe your board — condition, how it surfs, who it's good for, any dings or repairs..."
                      className="min-h-[120px] resize-none"
                      value={formData.description}
                      onChange={(e) => {
                        setFormData({ ...formData, description: e.target.value })
                        setDescriptionGenerated(false)
                      }}
                      required
                      disabled={isGeneratingDescription}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formData.description.length} / 1000
                    </span>
                    {descriptionGenerated && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Description written — feel free to edit
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isGeneratingDescription}
                          onClick={async () => {
                            if (formData.description.trim()) {
                              if (!window.confirm("This will replace your current description. Continue?")) return
                            }
                            setIsGeneratingDescription(true)
                            setDescriptionGenerated(false)
                            setFormData((f) => ({ ...f, description: "" }))
                            let fullText = ""
                            let buffer = ""
                            try {
                              const listingData = {
                                brand: formData.brand || formData.boardIndexLabel?.split(" ")[0] || "",
                                model: formData.boardIndexLabel || "",
                                condition: formData.condition,
                                length: boardLengthFormatted,
                                width: formData.boardWidthInches,
                                thickness: formData.boardThicknessInches,
                                volume: formData.boardVolumeL,
                                fins: formData.boardFins,
                                tail: formData.boardTail,
                                price: formData.price,
                                location: formData.locationDisplay || formData.locationCity || "",
                              }
                              const response = await fetch("/api/listings/generate-description", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ listingData }),
                              })
                              if (!response.ok) {
                                const errBody = await response.json().catch(() => null) as {
                                  error?: string
                                } | null
                                throw new Error(
                                  errBody?.error ||
                                    "Failed to generate description. Check that ANTHROPIC_API_KEY is set on the server.",
                                )
                              }
                              const reader = response.body!.getReader()
                              const decoder = new TextDecoder()
                              while (true) {
                                const { done, value } = await reader.read()
                                if (done) break
                                // Accumulate into buffer so lines split across chunks are reassembled
                                buffer += decoder.decode(value, { stream: true })
                                const lines = buffer.split("\n")
                                // Keep the incomplete trailing line in the buffer
                                buffer = lines.pop() ?? ""
                                for (const line of lines) {
                                  if (!line.startsWith("data: ")) continue
                                  const raw = line.slice(6).trim()
                                  if (raw === "[DONE]") continue
                                  // Parse JSON separately so malformed lines are skipped but real errors propagate
                                  let parsed: { text?: string; error?: string }
                                  try {
                                    parsed = JSON.parse(raw)
                                  } catch {
                                    continue
                                  }
                                  if (parsed.error) throw new Error(parsed.error)
                                  if (parsed.text) {
                                    fullText += parsed.text
                                    setFormData((f) => ({ ...f, description: fullText }))
                                  }
                                }
                              }
                              if (fullText.length > 0) setDescriptionGenerated(true)
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Failed to generate description")
                            } finally {
                              setIsGeneratingDescription(false)
                            }
                          }}
                          className="gap-1.5"
                        >
                          {isGeneratingDescription ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Writing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              {formData.description.trim() ? "Rewrite description" : "Write description for me"}
                            </>
                          )}
                        </Button>
                        {formData.description.trim() && !isGeneratingDescription && (
                          <span className="text-xs text-muted-foreground">
                            Will replace your current description
                          </span>
                        )}
                      </div>

                      {/* Quick add chips */}
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">Quick add:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "Has been reglassed",
                            "No pressure dings",
                            "Fresh wax",
                            "Comes with board bag",
                            "Fin boxes in great shape",
                            "Minor heel dents",
                            "Good for beginners",
                            "Great for small waves",
                            "Rides bigger than it looks",
                          ].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => {
                                setFormData((f) => {
                                  const desc = f.description.trimEnd()
                                  const append = desc.endsWith(".")
                                    ? ` ${chip}.`
                                    : desc
                                      ? `, ${chip.toLowerCase()}`
                                      : chip
                                  return { ...f, description: desc + append }
                                })
                              }}
                              className="rounded-full border border-border px-2.5 py-0.5 text-xs hover:border-primary/50 hover:bg-muted/50 transition-colors"
                            >
                              + {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                </div>
                </SellFormSection>

                <SellFormSection title="Photos">
                <div className="space-y-2">
                  <Label className="sr-only">Listing photos</Label>
                  {optimizingAny ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      Optimizing images…
                    </p>
                  ) : null}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {images.map((image, index) => (
                      <div
                        key={image.clientId}
                        className="relative aspect-square rounded-lg overflow-hidden bg-muted flex flex-col"
                      >
                        <div className="relative flex-1 min-h-0">
                          <Image
                            src={
                              image.thumbnailUrl ||
                              image.url ||
                              image.previewUrl ||
                              "/placeholder.svg"
                            }
                            alt={`Photo ${index + 1}`}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background z-10"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <div className="absolute bottom-6 left-1 flex items-center gap-1 z-10">
                            {index === 0 && (
                              <span className="text-[10px] bg-primary text-primary-foreground px-1 rounded">
                                Main
                              </span>
                            )}
                          </div>
                          <div className="absolute bottom-6 right-1 flex gap-1 z-10">
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => moveImage(index, -1)}
                                className="p-1 rounded-full bg-background/80 hover:bg-background"
                                aria-label="Move left"
                              >
                                <ChevronLeft className="h-3 w-3" />
                              </button>
                            )}
                            {index < images.length - 1 && (
                              <button
                                type="button"
                                onClick={() => moveImage(index, 1)}
                                className="p-1 rounded-full bg-background/80 hover:bg-background"
                                aria-label="Move right"
                              >
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        {image.optimizePhase === "running" && image.uploadPhase === "idle" ? (
                          <div className="shrink-0 px-1 py-1 bg-background/90 border-t border-border/60">
                            <p className="text-[9px] text-muted-foreground text-center leading-tight">
                              Optimizing…
                            </p>
                          </div>
                        ) : image.uploadPhase === "uploading" ? (
                          <div className="shrink-0 px-1 pb-1 pt-0.5 space-y-0.5 bg-background/90 border-t border-border/60">
                            <p className="text-[9px] text-muted-foreground text-center leading-tight">
                              Uploading
                            </p>
                            <Progress value={image.progressFull} className="h-1" title="Full size" />
                            <Progress value={image.progressThumb} className="h-1" title="Thumbnail" />
                          </div>
                        ) : null}
                        {image.uploadPhase === "error" || image.optimizePhase === "error" ? (
                          <div className="shrink-0 p-1 bg-destructive/10 border-t border-destructive/20 space-y-1">
                            <p className="text-[9px] text-destructive line-clamp-2">
                              {image.errorMessage || "Failed"}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 w-full text-[10px] px-1"
                              onClick={() => retryListingPhotoUpload(image.clientId)}
                            >
                              <RefreshCw className="h-3 w-3 mr-0.5" />
                              Retry
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {images.length < 12 && (
                      <label className="relative aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center transition-colors overflow-hidden">
                        <Upload className="h-6 w-6 text-muted-foreground pointer-events-none" />
                        <span className="text-xs text-muted-foreground mt-1 pointer-events-none">Add</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageChange}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          aria-label="Add photos"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum 3 photos required, maximum 12. Only vertical (portrait) photos — height greater than width. First image is the main photo. Any common phone/camera format is OK; unsupported types are converted to JPEG automatically.
                  </p>
                  {images.length > 0 && images.length < 3 && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Add {3 - images.length} more photo{3 - images.length !== 1 ? "s" : ""} to meet the minimum (3 required).
                    </p>
                  )}
                </div>
                </SellFormSection>

                <SellFormSection title={editId ? "Save your listing" : "Publish your listing"}>
                {publishPreview && (
                  <div
                    className={cn(
                      "rounded-xl border p-4 flex gap-4 transition-colors",
                      publishPreview.status === "publishing" && "border-primary/25 bg-primary/[0.04]",
                      publishPreview.status === "live" && "border-emerald-500/30 bg-emerald-500/[0.06]",
                      publishPreview.status === "error" && "border-destructive/40 bg-destructive/[0.06]",
                    )}
                  >
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={publishPreview.coverUrl || "/placeholder.svg"}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground truncate">{publishPreview.title}</p>
                        {publishPreview.status === "publishing" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Publishing...
                          </span>
                        )}
                        {publishPreview.status === "live" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Live ✓
                          </span>
                        )}
                        {publishPreview.status === "error" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ${publishPreview.price}
                        {publishPreview.detailHref && publishPreview.status === "live" && (
                          <>
                            {" · "}
                            <Link
                              href={publishPreview.detailHref}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              View listing
                            </Link>
                          </>
                        )}
                      </p>
                      {publishPreview.status === "error" && (
                        <div className="pt-2 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {publishPreview.failedStepLabel ? (
                              <>
                                <span className="font-medium text-foreground">
                                  {publishPreview.failedStepLabel}
                                </span>
                                {" — "}
                              </>
                            ) : null}
                            {publishPreview.errorMessage}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => formRef.current?.requestSubmit()}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {loading ? (
                  <div
                    className={cn(
                      "relative w-full overflow-hidden rounded-xl border border-primary/20 bg-muted/40 p-5 space-y-4 shadow-sm",
                      "motion-safe:animate-pulse",
                    )}
                  >
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      {uploadPhaseLabels[submitStepIndex] ?? "Working..."}
                    </p>
                    <Progress value={listingSubmitProgressValue} className="h-2" />
                    <div className="flex gap-1.5">
                      {uploadPhaseLabels.map((label, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1.5 flex-1 rounded-full transition-colors",
                            i <= submitStepIndex ? "bg-primary" : "bg-muted-foreground/20",
                          )}
                          title={label}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {editId ? "Save in progress — please keep this tab open." : "Upload in progress — please keep this tab open."}
                    </p>
                  </div>
                ) : (
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full relative transition-shadow"
                    disabled={loading}
                  >
                    {editId ? "Save changes" : "Create Listing"}
                  </Button>
                )}
                </SellFormSection>
              </form>
              )}
        </div>
      </main>
  )
}

export default function SellPage() {
  return (
    <Suspense fallback={
        <div className="flex min-h-[50vh] flex-1 w-full items-center justify-center bg-muted py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    }>
      <SellPageContent />
    </Suspense>
  )
}
