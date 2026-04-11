"use client"

import React, { Suspense } from "react"

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
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
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Heart,
  Zap,
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
  boardFulfillmentFromChecks,
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
  sellDraftFormLooksFilled,
  type SellListingDraftFormSnapshot,
} from "@/lib/sell-listing-draft-idb"
import {
  clearRemoteResumeDraftIdStorage,
  clearSellServerDraftListingId,
  getRemoteResumeDraftIdFromStorage,
  getSellServerDraftListingId,
  setRemoteResumeDraftIdStorage,
  setSellServerDraftListingId,
} from "@/lib/sell-draft-local-meta"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { cn } from "@/lib/utils"
import { BrandInputWithSuggestions } from "@/components/brand-input-with-suggestions"
import { listingDetailPath } from "@/lib/listing-query"
import {
  validateSellListingForm,
  buildResolvedListingTitle,
  LISTING_TITLE_MAX_LENGTH,
  LISTING_MIN_PHOTOS,
  type BoardShippingCostMode,
  type SellFormValidationInput,
} from "@/lib/sell-form-validation"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"
import { FIN_SETUP_TAG_OPTIONS } from "@/lib/listing-fin-setup-tags"
import {
  boardDimensionDisplayFields,
  boardDimensionsToDbFields,
  formatBoardLengthForTitle,
  formatBoardLengthInputFromParts,
  isBoardLengthEntryComplete,
  isTapeStyleInchesEntryComplete,
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
  normalizeVolumeLitersInput,
  shouldShowLengthInchHint,
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
  const startFresh = searchParams.get("new") === "1"

  /** Start blank: clear session hint only (no auto-redirect — avoids loading flash). */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    if (startFresh) {
      clearSellServerDraftListingId()
      router.replace("/sell")
    }
  }, [startFresh, router])

  /**
   * Instant “Continue draft” hint: `remoteResumeDraftId` storage is cleared when local state
   * matches the server row, but `serverDraftListingId` session still holds the row id — use it
   * here so the strip does not wait on GET /api/listings/draft after a full navigation.
   */
  useLayoutEffect(() => {
    if (typeof window === "undefined" || editId) return
    const remote = getRemoteResumeDraftIdFromStorage()
    const server = getSellServerDraftListingId()
    const hint = remote ?? server
    if (hint) setRemoteResumeDraftId(hint)
  }, [editId])

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
  const [editListingStatus, setEditListingStatus] = useState<string | null>(null)
  const listingIsDraft = editListingStatus === "draft"
  /** Server draft row id while staying on `/sell` (no ?edit=) — source of truth with IDB. */
  const [localServerDraftId, setLocalServerDraftId] = useState<string | null>(null)
  /** Server draft id for “Continue” — primed from sessionStorage in useLayoutEffect (before paint). */
  const [remoteResumeDraftId, setRemoteResumeDraftId] = useState<string | null>(null)
  const [isDiscardingResumeDraft, setIsDiscardingResumeDraft] = useState(false)

  const effectiveEditId = editId ?? localServerDraftId
  const isLocalOnlyServerDraft = Boolean(localServerDraftId && !editId)
  const draftRowForImages = editId ?? localServerDraftId
  const treatAsDraftForSync =
    listingIsDraft || isLocalOnlyServerDraft

  const localServerDraftIdRef = useRef<string | null>(null)
  useEffect(() => {
    localServerDraftIdRef.current = localServerDraftId
  }, [localServerDraftId])

  useEffect(() => {
    if (searchParams.get("new") !== "1") return
    setLocalServerDraftId(null)
    setRemoteResumeDraftId(null)
    void clearSellListingDraft()
    clearSellServerDraftListingId()
    clearRemoteResumeDraftIdStorage()
  }, [searchParams])

  useEffect(() => {
    if (!remoteResumeDraftId || !localServerDraftId) return
    if (remoteResumeDraftId === localServerDraftId) {
      setRemoteResumeDraftId(null)
      clearRemoteResumeDraftIdStorage()
    }
  }, [remoteResumeDraftId, localServerDraftId])

  const handleDiscardResumeBannerDraft = useCallback(async () => {
    const id = remoteResumeDraftId
    if (!id) return
    setIsDiscardingResumeDraft(true)
    try {
      const res = await fetch(`/api/listings/draft?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        toast.error("Could not delete draft")
        return
      }
      void clearSellListingDraft()
      clearSellServerDraftListingId()
      clearRemoteResumeDraftIdStorage()
      setRemoteResumeDraftId(null)
      setLocalServerDraftId((prev) => (prev === id ? null : prev))
      toast.success("Draft deleted")
    } finally {
      setIsDiscardingResumeDraft(false)
    }
  }, [remoteResumeDraftId])

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
    boardShippingCostMode: "reswell" as BoardShippingCostMode,
    boardShippingPrice: "",
    autoPriceDrop: false,
    autoPriceDropFloor: "",
    buyerOffers: true,
    boardType: "",
    boardLength: "",
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

  const boardDimLengthRef = useRef<HTMLInputElement>(null)
  const boardDimWidthRef = useRef<HTMLInputElement>(null)
  const boardDimThicknessRef = useRef<HTMLInputElement>(null)
  const boardDimVolumeRef = useRef<HTMLInputElement>(null)
  const prevBoardLengthRef = useRef<string | undefined>(undefined)
  const prevBoardWidthRef = useRef<string | undefined>(undefined)
  const prevBoardThicknessRef = useRef<string | undefined>(undefined)

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
  const serverDraftPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftImageSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    () => formatBoardLengthForTitle(formData.boardLength),
    [formData.boardLength],
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
      boardLength: formData.boardLength,
      boardWidthInches: formData.boardWidthInches,
      boardThicknessInches: formData.boardThicknessInches,
      boardVolumeL: formData.boardVolumeL,
      boardFins: formData.boardFins,
      boardTail: formData.boardTail,
      boardFulfillment: formData.boardFulfillment,
      boardShippingCostMode: formData.boardShippingCostMode,
      boardShippingPrice: formData.boardShippingPrice,
      autoPriceDrop: formData.autoPriceDrop,
      autoPriceDropFloor: formData.autoPriceDropFloor,
      locationCity: formData.locationCity,
      locationState: formData.locationState,
    }),
    [formData],
  )
  const resolvedTitlePreview = useMemo(
    () => buildResolvedListingTitle(sellValidationForm),
    [sellValidationForm],
  )

  const deliveryFlags = useMemo(
    () => flagsFromBoardFulfillment(formData.boardFulfillment),
    [formData.boardFulfillment],
  )

  // Count completed board fields for progress indicator
  const boardFieldsCompleted = useMemo(() => {
    return [
      images.length >= LISTING_MIN_PHOTOS,
      formData.title.trim(),
      formData.boardLength.trim(),
      formData.boardWidthInches.trim(),
      formData.boardThicknessInches.trim(),
      formData.boardFins,
      formData.boardTail,
      formData.condition,
      formData.price.trim(),
      formData.description.trim(),
    ].filter(Boolean).length
  }, [images.length, formData.title, formData.boardLength, formData.boardWidthInches, formData.boardThicknessInches, formData.boardFins, formData.boardTail, formData.condition, formData.price, formData.description])

  // When a directory model is linked from the title field, offer to snap brand back to the catalog name
  const suggestedBrand = useMemo(() => {
    const s = formData.boardLinkedBrandName.trim()
    if (!s) return null
    if (formData.brand.trim().toLowerCase() === s.toLowerCase()) return null
    return s
  }, [formData.boardLinkedBrandName, formData.brand])

  const persistServerDraft = useCallback(
    async (opts?: { keepalive?: boolean }) => {
      if (!draftHydrated) return
      if (editLoading) return
      if (getImpersonation()) return
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      if (editId && !listingIsDraft) return
      if (!editId && !localServerDraftId) {
        const hasLocal =
          sellDraftFormLooksFilled(formData as SellListingDraftFormSnapshot) ||
          images.length > 0
        if (!hasLocal) return
      }
      const body = {
        listingId: editId ?? localServerDraftId,
        title: formData.title,
        description: formData.description,
        price: formData.price,
        condition: formData.condition,
        category: formData.category,
        brand: formData.brand,
        boardFulfillment: formData.boardFulfillment,
        boardShippingCostMode: formData.boardShippingCostMode,
        boardShippingPrice: formData.boardShippingPrice,
        autoPriceDrop: formData.autoPriceDrop,
        autoPriceDropFloor: formData.autoPriceDropFloor,
        buyerOffers: formData.buyerOffers,
        boardType: formData.boardType,
        boardLength: formData.boardLength,
        boardWidthInches: formData.boardWidthInches,
        boardThicknessInches: formData.boardThicknessInches,
        boardVolumeL: formData.boardVolumeL,
        boardFins: formData.boardFins,
        boardTail: formData.boardTail,
        boardBrandId: formData.boardBrandId,
        locationLat: formData.locationLat,
        locationLng: formData.locationLng,
        locationCity: formData.locationCity,
        locationState: formData.locationState,
      }
      const init: RequestInit = {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
      if (opts?.keepalive) init.keepalive = true
      const res = await fetch("/api/listings/draft", init)
      if (!res.ok) return
      const json = (await res.json()) as { data?: { id?: string } }
      const id = json?.data?.id
      if (typeof id === "string") {
        setSellServerDraftListingId(id)
        setLocalServerDraftId(id)
        if (remoteResumeDraftId === id) {
          setRemoteResumeDraftId(null)
          clearRemoteResumeDraftIdStorage()
        }
      }
    },
    [
      draftHydrated,
      editId,
      localServerDraftId,
      formData,
      images.length,
      listingIsDraft,
      remoteResumeDraftId,
      supabase,
      editLoading,
    ],
  )

  useEffect(() => {
    if (!editId) {
      setEditListingStatus(null)
    }
  }, [editId])

  useEffect(() => {
    if (editId) {
      setDraftHydrated(true)
      return
    }
    let cancelled = false
    void (async () => {
      const draft = await loadSellListingDraft()
      if (cancelled) return
      if (draft?.serverListingId) {
        setLocalServerDraftId(draft.serverListingId)
        setSellServerDraftListingId(draft.serverListingId)
      }
      if (!draft) {
        setDraftHydrated(true)
        return
      }
      setFormData((prev) => {
        const fromDraft = draft.formData as Partial<typeof prev> & {
          boardLengthFt?: string
          boardLengthIn?: string
        }
        const merged = { ...prev, ...fromDraft }
        let boardLength = merged.boardLength
        if (typeof boardLength !== "string" || !boardLength.trim()) {
          const legacyFt = typeof fromDraft.boardLengthFt === "string" ? fromDraft.boardLengthFt : ""
          const legacyIn =
            typeof fromDraft.boardLengthIn === "string" ? fromDraft.boardLengthIn : ""
          boardLength = legacyFt.trim()
            ? formatBoardLengthInputFromParts(legacyFt, legacyIn)
            : ""
        }
        const next = { ...merged, boardLength }
        delete (next as Record<string, unknown>).boardLengthFt
        delete (next as Record<string, unknown>).boardLengthIn
        return next
      })
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

  /** Revalidate server draft in background — does not block first paint (banner uses sessionStorage). */
  useEffect(() => {
    if (editId) return
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const res = await fetch("/api/listings/draft", { credentials: "include" })
      if (!res.ok || cancelled) return
      const json = (await res.json()) as { data?: { draft?: { id: string } | null } }
      const rid = json?.data?.draft?.id
      if (typeof rid !== "string" || !rid) {
        clearRemoteResumeDraftIdStorage()
        clearSellServerDraftListingId()
        setRemoteResumeDraftId(null)
        return
      }
      setSellServerDraftListingId(rid)
      if (rid !== localServerDraftIdRef.current) {
        setRemoteResumeDraftId(rid)
        setRemoteResumeDraftIdStorage(rid)
      } else {
        setRemoteResumeDraftId(null)
        clearRemoteResumeDraftIdStorage()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editId, supabase])

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
          localServerDraftIdRef.current,
        )
        if (built) await saveSellListingDraft(built)
        else await clearSellListingDraft()
      })()
    }, 600)
    return () => {
      if (sellDraftPersistTimerRef.current) clearTimeout(sellDraftPersistTimerRef.current)
    }
  }, [editId, draftHydrated, formData, images, localServerDraftId])

  useEffect(() => {
    if (!draftHydrated) return
    if (editLoading) return
    if (getImpersonation()) return
    if (editId && !listingIsDraft) return
    if (!editId && !localServerDraftId) {
      const hasLocal =
        sellDraftFormLooksFilled(formData as SellListingDraftFormSnapshot) ||
        images.length > 0
      if (!hasLocal) return
    }
    if (serverDraftPersistTimerRef.current) clearTimeout(serverDraftPersistTimerRef.current)
    serverDraftPersistTimerRef.current = setTimeout(() => {
      serverDraftPersistTimerRef.current = null
      void persistServerDraft()
    }, 900)
    return () => {
      if (serverDraftPersistTimerRef.current) clearTimeout(serverDraftPersistTimerRef.current)
    }
  }, [
    draftHydrated,
    editLoading,
    editId,
    localServerDraftId,
    listingIsDraft,
    formData,
    images.length,
    persistServerDraft,
  ])

  const persistServerDraftRef = useRef(persistServerDraft)
  persistServerDraftRef.current = persistServerDraft

  useEffect(() => {
    const flushIdb = () => {
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
    const flushAll = () => {
      flushIdb()
      void persistServerDraftRef.current({ keepalive: true })
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") flushAll()
    }
    window.addEventListener("pagehide", flushAll)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("pagehide", flushAll)
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
      const st = (listing as { status?: string }).status
      setEditListingStatus(typeof st === "string" ? st : null)
      if (st === "draft") {
        setSellServerDraftListingId(String(listing.id))
      }
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
      let boardShippingCostMode: BoardShippingCostMode = "reswell"
      if (
        loadedFulfillment === "shipping_only" ||
        loadedFulfillment === "pickup_and_shipping"
      ) {
        const p = listing.shipping_price
        if (p != null && p !== "") {
          const n = parseFloat(String(p).replace(/,/g, ""))
          if (Number.isFinite(n) && n > 0) boardShippingCostMode = "flat"
        }
      }
      setFormData({
        title: listing.title ?? "",
        description: listing.description ?? "",
        price: String(listing.price ?? ""),
        category: listing.category_id ?? "",
        condition: listing.condition ?? "",
        brand: (listing as { brand?: string | null }).brand?.trim() ?? "",
        boardFulfillment: loadedFulfillment,
        boardShippingCostMode,
        boardShippingPrice,
        autoPriceDrop: (() => {
          const f = (listing as { auto_price_drop_floor?: number | string | null })
            .auto_price_drop_floor
          return f != null && f !== ""
        })(),
        autoPriceDropFloor: (() => {
          const f = (listing as { auto_price_drop_floor?: number | string | null })
            .auto_price_drop_floor
          if (f == null || f === "") return ""
          return String(f)
        })(),
        buyerOffers:
          (listing as { buyer_offers_enabled?: boolean | null }).buyer_offers_enabled !== false,
        boardType: listing.board_type ?? "",
        boardLength: formatBoardLengthInputFromParts(
          lengthFeet ? lengthFeet : "",
          (listing as { length_inches_display?: string | null }).length_inches_display?.trim() ||
            (listing.length_inches != null && Number(listing.length_inches) !== 0
              ? String(listing.length_inches)
              : ""),
        ),
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

  useEffect(() => {
    if (!treatAsDraftForSync || !draftRowForImages || editLoading) return
    const ready =
      images.length > 0 &&
      images.every((im) => im.uploadPhase === "done" && Boolean(im.url?.trim()))
    if (!ready) return
    if (draftImageSyncTimerRef.current) clearTimeout(draftImageSyncTimerRef.current)
    draftImageSyncTimerRef.current = setTimeout(() => {
      draftImageSyncTimerRef.current = null
      void syncListingImages(draftRowForImages).catch((e) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[sell] draft listing_images sync", e)
        }
      })
    }, 1200)
    return () => {
      if (draftImageSyncTimerRef.current) clearTimeout(draftImageSyncTimerRef.current)
    }
  }, [treatAsDraftForSync, draftRowForImages, editLoading, images])

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
        const file = await toJpegIfUnsupported(src)
        prepared = await prepareListingImagePairFromFile(file)
        let nextPreviewUrl = previewUrl
        if (previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl)
        }
        nextPreviewUrl = URL.createObjectURL(prepared.thumb)
        setImages((prev) =>
          prev.map((s) =>
            s.clientId === clientId
              ? {
                  ...s,
                  previewUrl: nextPreviewUrl,
                  optimizePhase: "done",
                  prepared,
                  sourceFile: undefined,
                }
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
              const mode = fd.boardShippingCostMode ?? "reswell"
              if (mode === "flat") {
                const raw = fd.boardShippingPrice.trim()
                if (adminImpersonationEditListing && !raw) return 0
                return parseFloat(raw)
              }
              return 0
            })()
          : null,
      }

      const boardLocationLat = fd.locationLat ? fd.locationLat : null
      const boardLocationLng = fd.locationLng ? fd.locationLng : null
      const boardLocationCity = fd.locationCity.trim() || null
      const boardLocationState = fd.locationState.trim() || null

      const boardLengthFmt = formatBoardLengthForTitle(fd.boardLength)
      const resolvedListingTitle = boardLengthFmt
        ? listingTitleWithBoardLength(fd.title, boardLengthFmt)
        : fd.title.trim()

      const flowImpersonation = !!listingImpersonation
      if (!effectiveEditId && !flowImpersonation) {
        const labels = [
          "Saving your listing...",
          "Attaching photos...",
          "Almost there...",
        ]
        uploadPhaseLabelsRef.current = labels
        setUploadPhaseLabels(labels)
      } else if (effectiveEditId && !flowImpersonation) {
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

      if (!effectiveEditId && !flowImpersonation) {
        await new Promise((r) => setTimeout(r, 200))
      }

      let listingId: string | null = effectiveEditId
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

      if (effectiveEditId) {
        const isLocalOnlyServerDraftSubmit = Boolean(localServerDraftId && !editId)
        if (!isLocalOnlyServerDraftSubmit && editId && !editListingOwnerId) {
          toast.error("Listing is still loading. Try again in a moment.")
          setLoading(false)
          return
        }
        const ownerEditsOwnListing =
          isLocalOnlyServerDraftSubmit || user.id === editListingOwnerId
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
          auto_price_drop_floor: fd.autoPriceDrop
            ? parseFloat(fd.autoPriceDropFloor.trim().replace(/,/g, ""))
            : null,
          buyer_offers_enabled: fd.buyerOffers !== false,
          brand: fd.brand.trim() ? fd.brand.trim() : null,
          brand_id: fd.boardBrandId.trim() || null,
        }

        if (ownerEditsOwnListing) {
          let publishSlug: string | null = null
          const publishingFromDraftRow = listingIsDraft || isLocalOnlyServerDraftSubmit
          if (publishingFromDraftRow) {
            publishSlug = await generateUniqueListingSlug(supabase, resolvedListingTitle)
          }
          const updatePayload = {
            ...editListingFields,
            updated_at: new Date().toISOString(),
            ...(publishingFromDraftRow
              ? {
                  status: "active" as const,
                  hidden_from_site: false,
                  slug: publishSlug ?? undefined,
                }
              : {}),
          }
          let { data: updated, error: updateError } = await supabase
            .from("listings")
            .update(updatePayload)
            .eq("id", effectiveEditId)
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
                ...(publishingFromDraftRow
                  ? {
                      status: "active" as const,
                      hidden_from_site: false,
                      slug: publishSlug ?? undefined,
                    }
                  : {}),
              })
              .eq("id", effectiveEditId)
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
              listingId: effectiveEditId,
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
          auto_price_drop_floor: fd.autoPriceDrop
            ? parseFloat(fd.autoPriceDropFloor.trim().replace(/,/g, ""))
            : null,
          buyer_offers_enabled: fd.buyerOffers !== false,
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
        if (!effectiveEditId && !listingImpersonation) {
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
          clearSellServerDraftListingId()
          clearRemoteResumeDraftIdStorage()
          setLocalServerDraftId(null)
          setRemoteResumeDraftId(null)
          router.push(detailPath)
          return
        }
        if (effectiveEditId && !usedImpersonationListingApi) {
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
        const msg = effectiveEditId
          ? `Listing updated for ${impersonationSellerLabel}`
          : `Listing created for ${impersonationSellerLabel}`
        if (tidDone != null) toast.success(`${msg} 🎉`, { id: tidDone })
        else toast.success(msg)
      } else {
        const msg = effectiveEditId ? "Listing updated!" : "Your listing is live! 🎉"
        if (tidDone != null) toast.success(msg, { id: tidDone })
        else toast.success(effectiveEditId ? "Listing updated!" : "Your listing is live! 🎉")
      }
      void clearSellListingDraft()
      clearSellServerDraftListingId()
      clearRemoteResumeDraftIdStorage()
      setLocalServerDraftId(null)
      setRemoteResumeDraftId(null)
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
      boardShippingCostMode: "reswell",
      boardShippingPrice: "",
      autoPriceDrop: false,
      autoPriceDropFloor: "",
      buyerOffers: true,
      boardType,
      boardLength: "5'8",
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

          {!editId &&
          remoteResumeDraftId &&
          remoteResumeDraftId !== localServerDraftId ? (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Draft</span>
                {" — "}
                Continue where you left off.
              </p>
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={isDiscardingResumeDraft}
                  aria-label="Delete draft"
                  onClick={() => void handleDiscardResumeBannerDraft()}
                >
                  {isDiscardingResumeDraft ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  disabled={isDiscardingResumeDraft}
                  onClick={() => router.push(`/sell?edit=${remoteResumeDraftId}`)}
                >
                  Continue
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mb-10 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                  {editId
                    ? listingIsDraft
                      ? "Continue your listing"
                      : "Edit listing"
                    : "Create a Listing"}
                </h1>
                <p className="text-sm text-muted-foreground lg:text-base">
                  {editId
                    ? listingIsDraft
                      ? "Draft — finish details and publish when you are ready."
                      : "Update your listing details"
                    : "List your surfboard for buyers on Reswell"}
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
                          {FIN_SETUP_TAG_OPTIONS.map((opt) => (
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
                            <div
                              className={cn(
                                "flex min-h-10 min-w-0 max-w-[10rem] flex-1 items-center justify-center gap-0.5 rounded-md border border-input bg-background px-1.5 shadow-sm ring-offset-background",
                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                              )}
                            >
                              <Input
                                ref={boardDimLengthRef}
                                type="text"
                                inputMode="decimal"
                                placeholder="6'2"
                                value={formData.boardLength}
                                onChange={(e) => {
                                  const next = normalizeBoardLengthInput(e.target.value)
                                  const prev = prevBoardLengthRef.current ?? ""
                                  prevBoardLengthRef.current = next
                                  setFormData((fd) => ({ ...fd, boardLength: next }))
                                  if (
                                    !isBoardLengthEntryComplete(prev) &&
                                    isBoardLengthEntryComplete(next)
                                  ) {
                                    requestAnimationFrame(() =>
                                      boardDimWidthRef.current?.focus({ preventScroll: true }),
                                    )
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return
                                  const next = normalizeBoardLengthInput(
                                    (e.target as HTMLInputElement).value,
                                  )
                                  if (!isBoardLengthEntryComplete(next)) return
                                  e.preventDefault()
                                  boardDimWidthRef.current?.focus({ preventScroll: true })
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-base shadow-none tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                                required
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Board length in feet and inches"
                                aria-describedby={
                                  shouldShowLengthInchHint(formData.boardLength)
                                    ? "sell-length-inches-hint-sr"
                                    : undefined
                                }
                              />
                              {shouldShowLengthInchHint(formData.boardLength) ? (
                                <>
                                  <span id="sell-length-inches-hint-sr" className="sr-only">
                                    {`Then type inches after the apostrophe (for example six foot two as 6'2).`}
                                  </span>
                                  <span
                                    className="pointer-events-none shrink-0 select-none text-sm tabular-nums text-muted-foreground/55"
                                    aria-hidden
                                  >
                                    <span className="font-medium text-muted-foreground/70">'</span>
                                    <span>·</span>
                                    <span className="opacity-80">_</span>
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Width */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Width</Label>
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                "flex min-h-10 min-w-0 max-w-[11rem] flex-1 items-center justify-center rounded-md border border-input bg-background px-1.5 shadow-sm ring-offset-background",
                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                              )}
                            >
                              <Input
                                ref={boardDimWidthRef}
                                type="text"
                                inputMode="decimal"
                                placeholder="19 1/4"
                                value={formData.boardWidthInches}
                                onChange={(e) => {
                                  const next = normalizeTapeStyleInchesInput(e.target.value)
                                  const prev = prevBoardWidthRef.current ?? ""
                                  prevBoardWidthRef.current = next
                                  setFormData((fd) => ({ ...fd, boardWidthInches: next }))
                                  if (
                                    !isTapeStyleInchesEntryComplete(prev) &&
                                    isTapeStyleInchesEntryComplete(next)
                                  ) {
                                    requestAnimationFrame(() =>
                                      boardDimThicknessRef.current?.focus({ preventScroll: true }),
                                    )
                                  }
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-base shadow-none tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Board width in inches"
                              />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">in</span>
                          </div>
                        </div>

                        {/* Thickness */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Thickness</Label>
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                "flex min-h-10 min-w-0 max-w-[11rem] flex-1 items-center justify-center rounded-md border border-input bg-background px-1.5 shadow-sm ring-offset-background",
                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                              )}
                            >
                              <Input
                                ref={boardDimThicknessRef}
                                type="text"
                                inputMode="decimal"
                                placeholder="2 3/8"
                                value={formData.boardThicknessInches}
                                onChange={(e) => {
                                  const next = normalizeTapeStyleInchesInput(e.target.value)
                                  const prev = prevBoardThicknessRef.current ?? ""
                                  prevBoardThicknessRef.current = next
                                  setFormData((fd) => ({ ...fd, boardThicknessInches: next }))
                                  if (
                                    !isTapeStyleInchesEntryComplete(prev) &&
                                    isTapeStyleInchesEntryComplete(next)
                                  ) {
                                    requestAnimationFrame(() =>
                                      boardDimVolumeRef.current?.focus({ preventScroll: true }),
                                    )
                                  }
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-base shadow-none tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Board thickness in inches"
                              />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">in</span>
                          </div>
                        </div>

                        {/* Volume */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Volume</Label>
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                "flex min-h-10 min-w-0 max-w-[11rem] flex-1 items-center justify-center rounded-md border border-input bg-background px-1.5 shadow-sm ring-offset-background",
                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                              )}
                            >
                              <Input
                                ref={boardDimVolumeRef}
                                type="text"
                                inputMode="decimal"
                                placeholder="30.4"
                                value={formData.boardVolumeL}
                                onChange={(e) =>
                                  setFormData((fd) => ({
                                    ...fd,
                                    boardVolumeL: normalizeVolumeLitersInput(e.target.value),
                                  }))
                                }
                                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-base shadow-none tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Board volume in liters"
                              />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">L</span>
                          </div>
                        </div>
                      </div>
                    </div>
                </SellFormSection>

                <SellFormSection
                  title="Pickup & shipping · where you're listing from"
                  description="Choose delivery options, then pin where the board is (pickup area or ship-from location) on the map."
                >
                  <div className="space-y-8">
                    <div className="space-y-6">
                      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            Delivery options{" "}
                            <span className="text-destructive" aria-hidden="true">
                              *
                            </span>
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            You can select both options.
                          </p>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="sell-delivery-shipping"
                              checked={deliveryFlags.shipping_available}
                              onCheckedChange={(v) => {
                                const want = v === true
                                const cur = flagsFromBoardFulfillment(formData.boardFulfillment)
                                let ns = want
                                let np = cur.local_pickup
                                if (!ns && !np) np = true
                                setFormData({
                                  ...formData,
                                  boardFulfillment: boardFulfillmentFromChecks(ns, np),
                                })
                              }}
                              className="mt-0.5"
                            />
                            <div className="space-y-0.5 min-w-0">
                              <Label
                                htmlFor="sell-delivery-shipping"
                                className="text-sm font-medium leading-snug cursor-pointer flex flex-wrap items-center gap-2"
                              >
                                Shipping
                                <Badge
                                  variant="default"
                                  className="border-0 bg-[#2563eb] text-white font-bold uppercase tracking-wide text-[10px] px-2 py-0.5 h-auto"
                                >
                                  Items sell faster
                                </Badge>
                              </Label>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="sell-delivery-pickup"
                              checked={deliveryFlags.local_pickup}
                              onCheckedChange={(v) => {
                                const want = v === true
                                const cur = flagsFromBoardFulfillment(formData.boardFulfillment)
                                let ns = cur.shipping_available
                                let np = want
                                if (!ns && !np) ns = true
                                setFormData({
                                  ...formData,
                                  boardFulfillment: boardFulfillmentFromChecks(ns, np),
                                })
                              }}
                              className="mt-0.5"
                            />
                            <Label
                              htmlFor="sell-delivery-pickup"
                              className="text-sm font-medium leading-snug cursor-pointer pt-0.5"
                            >
                              Local pickup
                            </Label>
                          </div>
                        </div>
                      </div>

                      {deliveryFlags.shipping_available ? (
                        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
                          <h3 className="text-sm font-semibold text-foreground">
                            Shipping cost in the Continental U.S.{" "}
                            <span className="text-destructive" aria-hidden="true">
                              *
                            </span>
                          </h3>
                          <RadioGroup
                            value={formData.boardShippingCostMode}
                            onValueChange={(value) =>
                              setFormData({
                                ...formData,
                                boardShippingCostMode: value as BoardShippingCostMode,
                              })
                            }
                            className="space-y-3"
                          >
                            <label
                              htmlFor="sell-ship-mode-reswell"
                              className={cn(
                                "flex gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                                formData.boardShippingCostMode === "reswell"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/35",
                              )}
                            >
                              <RadioGroupItem
                                value="reswell"
                                id="sell-ship-mode-reswell"
                                className="mt-0.5"
                              />
                              <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                                <span className="text-sm font-medium leading-snug">
                                  Let Reswell determine the shipping cost for you
                                </span>
                                <Badge
                                  variant="default"
                                  className="border-0 bg-[#2563eb] text-white font-bold uppercase tracking-wide text-[10px] px-2 py-0.5 h-auto shrink-0"
                                >
                                  Recommended
                                </Badge>
                              </div>
                            </label>
                            <label
                              htmlFor="sell-ship-mode-free"
                              className={cn(
                                "flex gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                                formData.boardShippingCostMode === "free"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/35",
                              )}
                            >
                              <RadioGroupItem value="free" id="sell-ship-mode-free" className="mt-0.5" />
                              <span className="text-sm font-medium leading-snug pt-0.5">
                                Offer free shipping
                              </span>
                            </label>
                            <label
                              htmlFor="sell-ship-mode-flat"
                              className={cn(
                                "flex gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                                formData.boardShippingCostMode === "flat"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/35",
                              )}
                            >
                              <RadioGroupItem value="flat" id="sell-ship-mode-flat" className="mt-0.5" />
                              <span className="text-sm font-medium leading-snug pt-0.5">
                                Set a flat shipping rate
                              </span>
                            </label>
                          </RadioGroup>
                          {formData.boardShippingCostMode === "flat" ? (
                            <div className="space-y-2 pl-7 sm:pl-8">
                              <Label htmlFor="boardShippingPrice">Flat rate ($) *</Label>
                              <Input
                                id="boardShippingPrice"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.boardShippingPrice}
                                onChange={(e) =>
                                  setFormData({ ...formData, boardShippingPrice: e.target.value })
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
                        <div className="flex gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"
                            aria-hidden
                          >
                            <Zap className="h-4 w-4" strokeWidth={2.5} />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <h3 className="text-sm font-semibold text-foreground">
                              Sell your board even faster
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Increase your chances of selling with price drops and offers.
                            </p>
                          </div>
                        </div>

                        <Separator className="my-5" />

                        <div className="space-y-4">
                          <div className="flex gap-4">
                            <Switch
                              id="sell-auto-price-drop"
                              checked={formData.autoPriceDrop}
                              onCheckedChange={(v) =>
                                setFormData({ ...formData, autoPriceDrop: v === true })
                              }
                              className="mt-0.5 shrink-0 data-[state=checked]:bg-emerald-600"
                              aria-label="Drop the price in 2 weeks if not sold"
                            />
                            <div className="min-w-0 space-y-1">
                              <Label
                                htmlFor="sell-auto-price-drop"
                                className="text-sm font-medium text-foreground cursor-pointer"
                              >
                                Drop the price in 2 weeks
                              </Label>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                If it hasn&apos;t sold, we can lower your list price after two weeks.
                                You choose the floor — we won&apos;t go below that price.
                              </p>
                            </div>
                          </div>
                          {formData.autoPriceDrop ? (
                            <div className="space-y-2 sm:pl-14">
                              <Label htmlFor="sell-auto-price-drop-floor">
                                Lowest price after 2 weeks ($) *
                              </Label>
                              <Input
                                id="sell-auto-price-drop-floor"
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.autoPriceDropFloor}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    autoPriceDropFloor: e.target.value,
                                  })
                                }
                              />
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                Must be less than your list price. When automation ships, this is the
                                minimum your listing will show after the scheduled drop.
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <Separator className="my-5" />

                        <div className="flex gap-4">
                          <Switch
                            id="sell-buyer-offers"
                            checked={formData.buyerOffers}
                            onCheckedChange={(v) =>
                              setFormData({ ...formData, buyerOffers: v === true })
                            }
                            className="mt-0.5 shrink-0 data-[state=checked]:bg-emerald-600"
                            aria-label="Allow buyers to make offers"
                          />
                          <div className="min-w-0 space-y-1">
                            <Label
                              htmlFor="sell-buyer-offers"
                              className="text-sm font-medium text-foreground cursor-pointer"
                            >
                              Allow buyers to make offers
                            </Label>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Lets you negotiate a final price with buyers before checkout.
                            </p>
                          </div>
                        </div>
                      </div>
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
                            className="object-cover object-center"
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
                    At least {LISTING_MIN_PHOTOS} photo, max 12. Upload a few angles of your board — top, bottom,
                    rails, fins, whatever helps someone see what they&apos;re buying. The more you add, the less
                    back-and-forth in messages. If a shot is horizontal we will rotate it into vertical; the first pic is your
                    cover. Any normal phone pic works; we&apos;ll swap odd formats to JPEG. Thank you for listing on
                    Reswell.{" "}
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span>Made with</span>
                      <Heart
                        className="h-4 w-4 shrink-0 fill-red-500 text-red-500"
                        aria-hidden
                      />
                      <span>in Santa Barbara.</span>
                    </span>
                  </p>
                  {images.length >= LISTING_MIN_PHOTOS && images.length < 12 && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Room for {12 - images.length} more — a fuller gallery usually gets more interest.
                    </p>
                  )}
                </div>
                </SellFormSection>

                <SellFormSection
                  title={
                    editId
                      ? listingIsDraft
                        ? "Publish your listing"
                        : "Save your listing"
                      : "Publish your listing"
                  }
                >
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
                        className="object-cover object-center"
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
                    {editId ? (listingIsDraft ? "Publish listing" : "Save changes") : "Create Listing"}
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
