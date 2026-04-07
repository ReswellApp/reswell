"use client"

import React, { Suspense } from "react"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
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
  description,
  children,
  className,
  complete,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  complete?: boolean
}) {
  return (
    <section className={cn("scroll-mt-24 space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          ) : null}
        </div>
        {complete ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Done
          </span>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function formatDecimalDimension(value: number): string {
  if (!Number.isFinite(value)) return ""
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
}

/** Parse typed dimensions: decimals, fractions (5/16), or mixed (2 5/16). */
function parseDimension(input: string): number | null {
  const normalized = input.trim()
  if (!normalized) return null
  if (/^\d*\.?\d+$/.test(normalized)) {
    const decimal = Number.parseFloat(normalized)
    return Number.isFinite(decimal) ? decimal : null
  }
  const mixedFraction = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixedFraction) {
    const whole = Number.parseInt(mixedFraction[1], 10)
    const numerator = Number.parseInt(mixedFraction[2], 10)
    const denominator = Number.parseInt(mixedFraction[3], 10)
    if (!denominator || numerator >= denominator) return null
    return whole + numerator / denominator
  }
  const fraction = normalized.match(/^(\d+)\/(\d+)$/)
  if (fraction) {
    const numerator = Number.parseInt(fraction[1], 10)
    const denominator = Number.parseInt(fraction[2], 10)
    if (!denominator || numerator >= denominator) return null
    return numerator / denominator
  }
  return null
}

/** Human-readable inches for summaries (e.g. 19.5 → 19 1/2). */
function formatDimensionInches(value: number): string {
  if (!Number.isFinite(value)) return ""
  const whole = Math.floor(value)
  const fraction = value - whole
  if (fraction < 0.0001) return String(whole)
  const denominator = 16
  const numerator = Math.round(fraction * denominator)
  if (numerator === 0) return String(whole)
  if (numerator === denominator) return String(whole + 1)
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const g = gcd(numerator, denominator)
  const n = numerator / g
  const d = denominator / g
  return whole > 0 ? `${whole} ${n}/${d}` : `${n}/${d}`
}

// Board type to category UUID mapping
const boardCategoryMap: Record<string, string> = {
  shortboard: "7e434a96-f3f7-4a73-b733-704a769195e6",
  longboard: "47a0d0bb-8738-43b4-a0fe-a5b2acc72fa3",
  funboard: "93b8eeaf-366b-4823-8bb9-98d42c5fefba",
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
    boardLengthIn: "0",
    boardWidthInches: "",
    boardThicknessInches: "",
    boardVolumeL: "",
    boardFins: "",
    boardTail: "",
    boardIndexBrandSlug: "",
    boardIndexModelSlug: "",
    boardIndexLabel: "",
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

  const [widthDimText, setWidthDimText] = useState("")
  const [thicknessDimText, setThicknessDimText] = useState("")
  const [widthDimError, setWidthDimError] = useState("")
  const [thicknessDimError, setThicknessDimError] = useState("")

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

  const boardLengthFormatted = useMemo(() => {
    const ft = formData.boardLengthFt.trim()
    if (!ft || isNaN(parseInt(ft, 10))) return ""
    const inn = parseFloat(formData.boardLengthIn)
    return `${parseInt(ft, 10)}'${formatDecimalDimension(Number.isFinite(inn) ? inn : 0)}"`
  }, [formData.boardLengthFt, formData.boardLengthIn])

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

  const boardLengthPreview = useMemo(() => {
    const ft = formData.boardLengthFt.trim()
    if (!ft || isNaN(parseInt(ft, 10))) return ""
    const inches = parseFloat(formData.boardLengthIn)
    if (!Number.isFinite(inches)) return `${parseInt(ft, 10)}'0"`
    return `${parseInt(ft, 10)}'${formatDecimalDimension(inches)}"`
  }, [formData.boardLengthFt, formData.boardLengthIn])

  const estimatedVolume = useMemo(() => {
    const ft = parseInt(formData.boardLengthFt, 10)
    const inn = parseFloat(formData.boardLengthIn) || 0
    const w = parseFloat(formData.boardWidthInches)
    const t = parseFloat(formData.boardThicknessInches)
    if (!formData.boardLengthFt || isNaN(ft) || isNaN(w) || isNaN(t)) return null
    const lengthIn = ft * 12 + inn
    return Math.round(lengthIn * w * t * 0.554 * 10) / 10
  }, [formData.boardLengthFt, formData.boardLengthIn, formData.boardWidthInches, formData.boardThicknessInches])

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

  const basicsComplete = useMemo(
    () =>
      Boolean(
        formData.category?.trim() &&
          formData.title?.trim() &&
          resolvedTitlePreview.length <= LISTING_TITLE_MAX_LENGTH,
      ),
    [formData.category, formData.title, resolvedTitlePreview.length],
  )

  const photosComplete = useMemo(() => images.length >= 3, [images.length])

  const specsComplete = useMemo(
    () =>
      Boolean(
        formData.boardLengthFt?.trim() &&
          formData.boardWidthInches?.trim() &&
          formData.boardThicknessInches?.trim() &&
          formData.boardFins?.trim() &&
          formData.boardTail?.trim(),
      ),
    [
      formData.boardLengthFt,
      formData.boardWidthInches,
      formData.boardThicknessInches,
      formData.boardFins,
      formData.boardTail,
    ],
  )

  const pickupComplete = useMemo(() => {
    const city = formData.locationCity?.trim()
    const st = formData.locationState?.trim()
    if (!city || !st) return false
    const flags = flagsFromBoardFulfillment(formData.boardFulfillment)
    if (flags.shipping_available) {
      const raw = formData.boardShippingPrice?.trim() ?? ""
      if (raw === "") return false
      const sp = parseFloat(raw)
      if (!Number.isFinite(sp) || sp < 0) return false
    }
    return true
  }, [
    formData.locationCity,
    formData.locationState,
    formData.boardFulfillment,
    formData.boardShippingPrice,
  ])

  const priceComplete = useMemo(() => {
    if (!formData.price?.trim() || !formData.condition?.trim()) return false
    const price = parseFloat(formData.price.trim())
    return Number.isFinite(price) && price >= 0.01 && price <= 999_999.99
  }, [formData.price, formData.condition])

  const descriptionComplete = useMemo(
    () => formData.description.trim().length > 0,
    [formData.description],
  )

  // Smart title suggestion when brand + model index + length are all filled
  const suggestedTitle = useMemo(() => {
    if (!formData.boardIndexLabel || !boardLengthFormatted) return null
    let suggested = `${formData.boardIndexLabel} - ${boardLengthFormatted}`
    if (suggested.length > LISTING_TITLE_MAX_LENGTH) {
      suggested = suggested.slice(0, LISTING_TITLE_MAX_LENGTH)
    }
    const currentTitle = formData.title.trim()
    if (currentTitle.toLowerCase() === suggested.toLowerCase()) return null
    return suggested
  }, [formData.boardIndexLabel, boardLengthFormatted, formData.title])

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
      const partial = draft.formData as Partial<SellListingDraftFormSnapshot>
      setFormData((prev) => ({ ...prev, ...partial }))
      const wDraft = typeof partial.boardWidthInches === "string" ? partial.boardWidthInches.trim() : ""
      const tDraft =
        typeof partial.boardThicknessInches === "string" ? partial.boardThicknessInches.trim() : ""
      if (wDraft) {
        const pv = parseFloat(wDraft)
        if (Number.isFinite(pv)) setWidthDimText(formatDimensionInches(pv))
      } else {
        setWidthDimText("")
      }
      if (tDraft) {
        const pv = parseFloat(tDraft)
        if (Number.isFinite(pv)) setThicknessDimText(formatDimensionInches(pv))
      } else {
        setThicknessDimText("")
      }
      setWidthDimError("")
      setThicknessDimError("")
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
      let query = supabase
        .from("listings")
        .select(
          `
          id,
          slug,
          user_id,
          section,
          status,
          title,
          description,
          price,
          condition,
          category_id,
          board_type,
          length_feet,
          length_inches,
          width,
          thickness,
          volume,
          fins_setup,
          tail_shape,
          latitude,
          longitude,
          city,
          state,
          local_pickup,
          shipping_available,
          shipping_price,
          brand,
          index_brand_slug,
          index_model_slug,
          index_model_label,
          listing_images (id, url, thumbnail_url, is_primary, sort_order)
        `
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
      const lengthInches = listing.length_inches != null ? String(listing.length_inches) : ""
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
        boardLengthIn: lengthInches ? lengthInches : "0",
        boardWidthInches: (listing as { width?: number | null }).width != null ? String((listing as { width?: number | null }).width) : "",
        boardThicknessInches: (listing as { thickness?: number | null }).thickness != null ? String((listing as { thickness?: number | null }).thickness) : "",
        boardVolumeL: (listing as { volume?: number | null }).volume != null ? String((listing as { volume?: number | null }).volume) : "",
        boardFins: (listing as { fins_setup?: string | null }).fins_setup ?? "",
        boardTail: (listing as { tail_shape?: string | null }).tail_shape ?? "",
        boardIndexBrandSlug: (listing as { index_brand_slug?: string | null }).index_brand_slug?.trim() ?? "",
        boardIndexModelSlug: (listing as { index_model_slug?: string | null }).index_model_slug?.trim() ?? "",
        boardIndexLabel: (listing as { index_model_label?: string | null }).index_model_label?.trim() ?? "",
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
      const widthNum = (listing as { width?: number | null }).width
      const thickNum = (listing as { thickness?: number | null }).thickness
      if (widthNum != null && Number.isFinite(Number(widthNum))) {
        setWidthDimText(formatDimensionInches(Number(widthNum)))
      } else {
        setWidthDimText("")
      }
      if (thickNum != null && Number.isFinite(Number(thickNum))) {
        setThicknessDimText(formatDimensionInches(Number(thickNum)))
      } else {
        setThicknessDimText("")
      }
      setWidthDimError("")
      setThicknessDimError("")
      setEditLoading(false)
    })()
    return () => { mounted = false }
  }, [editId, supabase, router])

  useEffect(() => {
    if (editId) return
    setWidthDimText("")
    setThicknessDimText("")
    setWidthDimError("")
    setThicknessDimError("")
  }, [editId])

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

  function commitWidthDimInput() {
    setWidthDimError("")
    const raw = widthDimText.trim()
    if (!raw) {
      setFormData((f) => ({ ...f, boardWidthInches: "" }))
      return
    }
    const p = parseDimension(raw)
    if (p == null) {
      setWidthDimError("Use a number or fraction, e.g. 19 1/2 or 19 5/16")
      return
    }
    setFormData((f) => ({ ...f, boardWidthInches: formatDecimalDimension(p) }))
    setWidthDimText(formatDimensionInches(p))
  }

  function commitThicknessDimInput() {
    setThicknessDimError("")
    const raw = thicknessDimText.trim()
    if (!raw) {
      setFormData((f) => ({ ...f, boardThicknessInches: "" }))
      return
    }
    const p = parseDimension(raw)
    if (p == null) {
      setThicknessDimError("Use a number or fraction, e.g. 2 5/16 or 2 1/4")
      return
    }
    setFormData((f) => ({ ...f, boardThicknessInches: formatDecimalDimension(p) }))
    setThicknessDimText(formatDimensionInches(p))
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

      let submitForm = { ...formData }
      const wTrim = widthDimText.trim()
      if (wTrim === "") {
        submitForm.boardWidthInches = ""
      } else {
        const pw = parseDimension(wTrim)
        if (pw == null) {
          toast.error("Width: enter a valid number or fraction (e.g. 19 1/2 or 19 5/16).")
          setLoading(false)
          return
        }
        submitForm.boardWidthInches = formatDecimalDimension(pw)
        setWidthDimText(formatDimensionInches(pw))
      }
      const tTrim = thicknessDimText.trim()
      if (tTrim === "") {
        submitForm.boardThicknessInches = ""
      } else {
        const pt = parseDimension(tTrim)
        if (pt == null) {
          toast.error("Thickness: enter a valid number or fraction (e.g. 2 5/16 or 2 1/4).")
          setLoading(false)
          return
        }
        submitForm.boardThicknessInches = formatDecimalDimension(pt)
        setThicknessDimText(formatDimensionInches(pt))
      }
      setFormData(submitForm)
      setWidthDimError("")
      setThicknessDimError("")

      const imagesUploadReady = !images.some(
        (im) =>
          im.uploadPhase !== "done" ||
          !im.url?.trim() ||
          !im.thumbnailUrl?.trim(),
      )

      const validationMessage = validateSellListingForm(
        { listingType: "board", ...submitForm } as SellFormValidationInput,
        { imageCount: images.length, imagesUploadReady },
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
          ? parseFloat(fd.boardShippingPrice.trim())
          : null,
      }

      const boardLocationLat = fd.locationLat ? fd.locationLat : null
      const boardLocationLng = fd.locationLng ? fd.locationLng : null
      const boardLocationCity = fd.locationCity.trim() || null
      const boardLocationState = fd.locationState.trim() || null

      const boardLengthFmt = fd.boardLengthFt.trim()
        ? `${parseInt(fd.boardLengthFt, 10)}'${formatDecimalDimension(parseFloat(fd.boardLengthIn) || 0)}"`
        : ""
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

        const editListingFields = {
          title: resolvedListingTitle,
          description: fd.description,
          price: parseFloat(fd.price),
          condition: fd.condition,
          category_id: fd.category,
          board_type: fd.boardType,
          length_feet: fd.boardLengthFt ? parseInt(fd.boardLengthFt, 10) : null,
          length_inches: fd.boardLengthFt ? parseFloat(fd.boardLengthIn) || 0 : null,
          width: fd.boardWidthInches ? parseFloat(fd.boardWidthInches) : null,
          thickness: fd.boardThicknessInches ? parseFloat(fd.boardThicknessInches) : null,
          volume: fd.boardVolumeL ? parseFloat(fd.boardVolumeL) : null,
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
          index_brand_slug: fd.boardIndexBrandSlug.trim() || null,
          index_model_slug: fd.boardIndexModelSlug.trim() || null,
          index_model_label: fd.boardIndexLabel.trim() || null,
        }

        if (ownerEditsOwnListing) {
          const { data: updated, error: updateError } = await supabase
            .from("listings")
            .update({ ...editListingFields, updated_at: new Date().toISOString() })
            .eq("id", editId)
            .eq("user_id", user.id)
            .select("slug")
            .single()
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
        const listingFields = {
          title: resolvedListingTitle,
          description: fd.description,
          price: parseFloat(fd.price),
          condition: fd.condition,
          section: "surfboards" as const,
          category_id: fd.category,
          board_type: fd.boardType,
          length_feet: fd.boardLengthFt ? parseInt(fd.boardLengthFt, 10) : null,
          length_inches: fd.boardLengthFt ? parseFloat(fd.boardLengthIn) || 0 : null,
          width: fd.boardWidthInches ? parseFloat(fd.boardWidthInches) : null,
          thickness: fd.boardThicknessInches ? parseFloat(fd.boardThicknessInches) : null,
          volume: fd.boardVolumeL ? parseFloat(fd.boardVolumeL) : null,
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
          index_brand_slug: fd.boardIndexBrandSlug.trim() || null,
          index_model_slug: fd.boardIndexModelSlug.trim() || null,
          index_model_label: fd.boardIndexLabel.trim() || null,
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
          const { data: listing, error: listingError } = await supabase
            .from("listings")
            .insert({
              user_id: user.id,
              ...listingFields,
              slug: newSlug,
              status: "active",
            })
            .select()
            .single()

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

  return (
      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>

          <Card>
            <CardHeader>
              <CardTitle>{editId ? "Edit listing" : "Create a Listing"}</CardTitle>
              <CardDescription>
                {editId ? "Update your listing details" : "List your surfboard for buyers on Reswell"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {editLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-10" aria-busy={loading}>
                <div className="space-y-2 rounded-xl border border-border/50 bg-muted/15 px-4 py-3 sm:px-5 sm:py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-foreground">Listing completeness</span>
                    <span className="tabular-nums text-muted-foreground">{boardFieldsCompleted} of 10</span>
                  </div>
                  <Progress
                    value={(boardFieldsCompleted / 10) * 100}
                    className="h-2.5 bg-muted"
                    aria-label={`${boardFieldsCompleted} of 10 required fields complete`}
                  />
                </div>

                <SellFormSection title="Basics" complete={basicsComplete}>
                <div className="space-y-5 rounded-xl border border-border/50 bg-muted/10 p-4 sm:p-5">
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
                    <SelectTrigger>
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
                </div>

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
                  <details className="group text-xs">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <ChevronDown
                        className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                      Title tips
                    </summary>
                    <p className="mt-2 border-l-2 border-border/70 py-0.5 pl-3 leading-relaxed text-muted-foreground">
                      Appears on your listing and in the link — max {LISTING_TITLE_MAX_LENGTH} characters including
                      board length. Pick a catalog model from suggestions to autofill brand and speed things up.
                    </p>
                  </details>
                      <SurfboardTitleIndexInput
                        id="title"
                        placeholder={`e.g., Channel Islands Dumpster Diver - 5'6"`}
                        value={formData.title}
                        onChange={(title) => setFormData((f) => ({ ...f, title }))}
                        boardLength={boardLengthFormatted}
                        onSelectModel={(opt: IndexBoardModelSelection) => {
                          setFormData((f) => {
                            const lenStr = f.boardLengthFt.trim()
                              ? `${parseInt(f.boardLengthFt, 10)}'${formatDecimalDimension(parseFloat(f.boardLengthIn) || 0)}"`
                              : ""
                            return {
                              ...f,
                              title: titleFromIndexModelPick(opt, lenStr).slice(
                                0,
                                LISTING_TITLE_MAX_LENGTH,
                              ),
                              boardIndexBrandSlug: opt.brandSlug,
                              boardIndexModelSlug: opt.modelSlug,
                              boardIndexLabel: opt.label,
                              brand: opt.brandName,
                            }
                          })
                        }}
                        required
                      />
                      {suggestedTitle && (
                        <p className="text-xs text-muted-foreground">
                          Suggested:{" "}
                          <span className="font-medium text-foreground">{suggestedTitle}</span>
                          {" — "}
                          <button
                            type="button"
                            className="text-primary underline-offset-2 hover:underline"
                            onClick={() => setFormData((f) => ({ ...f, title: suggestedTitle }))}
                          >
                            Use this
                          </button>
                        </p>
                      )}
                </div>

                    <div className="space-y-2">
                        <Label htmlFor="surf-brand">Brand / shaper (optional)</Label>
                        {formData.boardIndexBrandSlug && formData.boardIndexModelSlug ? (
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
                                    boardIndexBrandSlug: "",
                                    boardIndexModelSlug: "",
                                    boardIndexLabel: "",
                                  }))
                                }
                              >
                                Clear link
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <BrandInputWithSuggestions
                            id="surf-brand"
                            placeholder="e.g., Channel Islands"
                            value={formData.brand}
                            onChange={(v) => setFormData({ ...formData, brand: v })}
                            showHint={false}
                          />
                        )}
                    </div>
                </div>
                </SellFormSection>

                <SellFormSection title="Photos" complete={photosComplete}>
                <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-4 sm:p-5">
                  <Label>Photos (3–12 required)</Label>
                  {optimizingAny ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      Optimizing images…
                    </p>
                  ) : null}
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {images.map((image, index) => (
                      <div
                        key={image.clientId}
                        className="relative flex aspect-square flex-col overflow-hidden rounded-lg bg-muted"
                      >
                        <div className="relative min-h-0 flex-1">
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
                            className="absolute right-1 top-1 z-10 rounded-full bg-background/80 p-1 hover:bg-background"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <div className="absolute bottom-6 left-1 z-10 flex items-center gap-1">
                            {index === 0 && (
                              <span className="rounded bg-primary px-1 text-[10px] text-primary-foreground">
                                Main
                              </span>
                            )}
                          </div>
                          <div className="absolute bottom-6 right-1 z-10 flex gap-1">
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => moveImage(index, -1)}
                                className="rounded-full bg-background/80 p-1 hover:bg-background"
                                aria-label="Move left"
                              >
                                <ChevronLeft className="h-3 w-3" />
                              </button>
                            )}
                            {index < images.length - 1 && (
                              <button
                                type="button"
                                onClick={() => moveImage(index, 1)}
                                className="rounded-full bg-background/80 p-1 hover:bg-background"
                                aria-label="Move right"
                              >
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        {image.optimizePhase === "running" && image.uploadPhase === "idle" ? (
                          <div className="shrink-0 border-t border-border/60 bg-background/90 px-1 py-1">
                            <p className="text-center text-[9px] leading-tight text-muted-foreground">
                              Optimizing…
                            </p>
                          </div>
                        ) : image.uploadPhase === "uploading" ? (
                          <div className="shrink-0 space-y-0.5 border-t border-border/60 bg-background/90 px-1 pb-1 pt-0.5">
                            <p className="text-center text-[9px] leading-tight text-muted-foreground">
                              Uploading
                            </p>
                            <Progress value={image.progressFull} className="h-1" title="Full size" />
                            <Progress value={image.progressThumb} className="h-1" title="Thumbnail" />
                          </div>
                        ) : null}
                        {image.uploadPhase === "error" || image.optimizePhase === "error" ? (
                          <div className="shrink-0 space-y-1 border-t border-destructive/20 bg-destructive/10 p-1">
                            <p className="line-clamp-2 text-[9px] text-destructive">
                              {image.errorMessage || "Failed"}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 w-full px-1 text-[10px]"
                              onClick={() => retryListingPhotoUpload(image.clientId)}
                            >
                              <RefreshCw className="mr-0.5 h-3 w-3" />
                              Retry
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {images.length < 12 && (
                      <label className="relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary/50">
                        <Upload className="pointer-events-none h-6 w-6 text-muted-foreground" />
                        <span className="pointer-events-none mt-1 text-xs text-muted-foreground">Add</span>
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
                  <details className="group text-xs">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <ChevronDown
                        className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                      Photo requirements
                    </summary>
                    <p className="mt-2 border-l-2 border-border/70 py-0.5 pl-3 leading-relaxed text-muted-foreground">
                      3–12 portrait (vertical) images. First photo is the cover. Phone formats are fine; others
                      convert to JPEG automatically.
                    </p>
                  </details>
                  {images.length > 0 && images.length < 3 && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Add {3 - images.length} more photo{3 - images.length !== 1 ? "s" : ""} (minimum 3).
                    </p>
                  )}
                </div>
                </SellFormSection>

                <SellFormSection title="Board specifications" complete={specsComplete}>
                    {/* Board Dimensions */}
                    <div className="space-y-5 rounded-lg border border-border/60 bg-muted/10 p-4 sm:p-6">
                      <div>
                        <p className="text-sm font-medium text-foreground">Board dimensions</p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          Length and volume: type numbers. Width and thickness: type inches as a decimal or fraction
                          (e.g. 19 1/2 or 2 5/16).
                        </p>
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-3">
                          <Label htmlFor="board-len-ft">Length *</Label>
                          <div className="flex flex-wrap items-end gap-4">
                            <div className="space-y-1.5">
                              <span className="text-xs text-muted-foreground">Feet</span>
                              <Input
                                id="board-len-ft"
                                type="number"
                                inputMode="numeric"
                                min={4}
                                max={12}
                                step={1}
                                placeholder="6"
                                value={formData.boardLengthFt}
                                onChange={(e) => setFormData({ ...formData, boardLengthFt: e.target.value })}
                                className="h-11 w-[4.75rem] tabular-nums"
                                required
                                aria-label="Length in feet"
                              />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-[9rem]">
                              <span className="text-xs text-muted-foreground">Inches</span>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={11.875}
                                step={0.125}
                                placeholder="0"
                                value={formData.boardLengthIn === "0" ? "" : formData.boardLengthIn}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    boardLengthIn: e.target.value === "" ? "0" : e.target.value,
                                  })
                                }
                                className="h-11 tabular-nums"
                                aria-label="Length in inches"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="board-vol">Volume (L)</Label>
                          <Input
                            id="board-vol"
                            type="number"
                            inputMode="decimal"
                            min={10}
                            max={200}
                            step={0.1}
                            placeholder={
                              estimatedVolume != null ? `Est. ~${estimatedVolume}` : "e.g. 32.5"
                            }
                            value={formData.boardVolumeL}
                            onChange={(e) => setFormData({ ...formData, boardVolumeL: e.target.value })}
                            className="h-11 tabular-nums"
                          />
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Leave blank and we&apos;ll estimate from length, width, and thickness.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="board-width-dim">Width (inches) *</Label>
                          <Input
                            id="board-width-dim"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder='e.g. 19 1/2 or 19.5'
                            value={widthDimText}
                            onChange={(e) => {
                              setWidthDimText(e.target.value)
                              if (widthDimError) setWidthDimError("")
                            }}
                            onBlur={commitWidthDimInput}
                            className={cn("h-11 tabular-nums", widthDimError && "border-destructive")}
                            aria-invalid={!!widthDimError}
                            aria-describedby={widthDimError ? "board-width-dim-error" : undefined}
                          />
                          {widthDimError ? (
                            <p id="board-width-dim-error" className="text-xs text-destructive">
                              {widthDimError}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Across the deck, in inches — decimals or fractions like 19 5/16.
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="board-thickness-dim">Thickness (inches) *</Label>
                          <Input
                            id="board-thickness-dim"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder='e.g. 2 5/16 or 2.25'
                            value={thicknessDimText}
                            onChange={(e) => {
                              setThicknessDimText(e.target.value)
                              if (thicknessDimError) setThicknessDimError("")
                            }}
                            onBlur={commitThicknessDimInput}
                            className={cn("h-11 tabular-nums", thicknessDimError && "border-destructive")}
                            aria-invalid={!!thicknessDimError}
                            aria-describedby={thicknessDimError ? "board-thickness-dim-error" : undefined}
                          />
                          {thicknessDimError ? (
                            <p id="board-thickness-dim-error" className="text-xs text-destructive">
                              {thicknessDimError}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Rail to rail thickness — same formats as width.
                            </p>
                          )}
                        </div>
                      </div>

                      {boardLengthPreview ? (
                        <p className="border-t border-border/50 pt-4 text-xs font-medium tabular-nums text-muted-foreground">
                          {boardLengthPreview}
                          {formData.boardWidthInches &&
                            Number.isFinite(parseFloat(formData.boardWidthInches)) &&
                            ` × ${formatDimensionInches(parseFloat(formData.boardWidthInches))}"`}
                          {formData.boardThicknessInches &&
                            Number.isFinite(parseFloat(formData.boardThicknessInches)) &&
                            ` × ${formatDimensionInches(parseFloat(formData.boardThicknessInches))}"`}
                          {(formData.boardVolumeL || estimatedVolume) &&
                            ` — ${formData.boardVolumeL || `~${estimatedVolume}`} L`}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                    {/* Fins Setup */}
                    <div className="space-y-2">
                      <Label>Fin setup *</Label>
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
                              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all outline-none",
                              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              formData.boardFins === opt.value
                                ? "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/25"
                                : "border-border bg-background hover:border-primary/45 hover:bg-muted/50",
                            )}
                          >
                            {formData.boardFins === opt.value ? (
                              <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                            ) : null}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tail Shape */}
                    <div className="space-y-2">
                      <Label>Tail shape *</Label>
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
                              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all outline-none",
                              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              formData.boardTail === opt.value
                                ? "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/25"
                                : "border-border bg-background hover:border-primary/45 hover:bg-muted/50",
                            )}
                          >
                            {formData.boardTail === opt.value ? (
                              <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                            ) : null}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    </div>
                </SellFormSection>

                <SellFormSection title="Pickup & delivery" complete={pickupComplete}>
                  <details className="group text-xs">
                    <summary className="mb-3 flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <ChevronDown
                        className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                      Why we need location & shipping
                    </summary>
                    <p className="mb-3 border-l-2 border-border/70 py-0.5 pl-3 leading-relaxed text-muted-foreground">
                      Your listing location helps nearby buyers find you. If you ship, add a flat rate below (0 =
                      free shipping).
                    </p>
                  </details>
                  <div className="space-y-4 rounded-lg border border-border/60 bg-muted/15 p-4 sm:p-5">
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
                            className={cn(
                              "rounded-lg border-2 p-3 text-left text-sm transition-all outline-none text-balance",
                              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              formData.boardFulfillment === opt.value
                                ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/15"
                                : "border-border hover:border-primary/40 hover:bg-muted/30",
                            )}
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
                      setFormData((f) => ({
                        ...f,
                        locationLat: loc.lat,
                        locationLng: loc.lng,
                        locationCity: loc.city,
                        locationState: loc.state,
                        locationDisplay: loc.displayName,
                      }))
                    }}
                    initialLat={formData.locationLat || undefined}
                    initialLng={formData.locationLng || undefined}
                    initialCity={formData.locationCity || undefined}
                    initialState={formData.locationState || undefined}
                    initialDisplay={formData.locationDisplay || undefined}
                  />
                </SellFormSection>

                <SellFormSection title="Price & condition" complete={priceComplete}>
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

                <SellFormSection title="Description" complete={descriptionComplete}>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your board — condition, how it surfs, who it's good for, any dings or repairs..."
                      className="min-h-[120px] resize-none"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.description.length} / 1000
                    </p>
                  </div>
                </SellFormSection>

                <div className="space-y-6 border-t border-border/50 pt-8">
                {/* Optimistic preview + submit / progress */}
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
                </div>
              </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
  )
}

export default function SellPage() {
  return (
    <Suspense fallback={
        <div className="flex flex-1 items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    }>
      <SellPageContent />
    </Suspense>
  )
}
