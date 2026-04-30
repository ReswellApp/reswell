"use client"
/** Sell flow: free-form listing title; brand line uses catalog (brands) + request CTA; no separate shaper field. */


import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  useId,
} from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Upload,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Heart,
  Zap,
} from "lucide-react"
import { LocationPicker } from "@/components/location-picker"
import { listingDetailHref } from "@/lib/listing-href"
import {
  boardFulfillmentFromChecks,
  boardFulfillmentFromFlags,
  flagsFromBoardFulfillment,
  type BoardFulfillmentChoice,
} from "@/lib/listing-fulfillment"
import {
  reswellPackageFieldsToDb,
  reswellPackageFormFromDbRow,
  resolveListingFulfillmentFlagsForSellSubmit,
} from "@/lib/sell-listing-fulfillment-flags"
import { slugify } from "@/lib/slugify"
import {
  clearImpersonation,
  clearImpersonationStorageIfCookieMissing,
  getImpersonation,
  type ImpersonationData,
} from "@/lib/impersonation"
import type { IndexBoardModelSelection } from "@/components/index-board-model-combobox"
import { SurfboardTitleIndexInput } from "@/components/surfboard-title-index-input"
import {
  assertListingOriginalSize,
  browserCanDecodeImage as pipelineCanDecodeImage,
  prepareListingImagePairFromFile,
  type PreparedListingImagePair,
} from "@/lib/listing-image-pipeline"
import { uploadListingImagePairToSupabase } from "@/lib/listing-image-storage"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import {
  buildSellListingDraft,
  clearSellListingDraft,
  loadSellListingDraft,
  saveSellListingDraft,
  sellDraftFormLooksFilled,
  type SellListingDraftFormSnapshot,
} from "@/lib/sell-listing-draft-idb"
import { sellerPurchasePriceToDb } from "@/lib/utils/seller-purchase-price"
import {
  clearRemoteResumeDraftIdStorage,
  clearSellServerDraftListingId,
  setSellServerDraftListingId,
} from "@/lib/sell-draft-local-meta"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { cn } from "@/lib/utils"
import {
  RequestBrandModelDialog,
  type ListingCatalogRequestVariant,
} from "@/components/request-brand-model-dialog"
import { SellBoardModelField } from "@/components/sell-board-model-field"
import { listingDetailPath } from "@/lib/listing-query"
import { revalidateListingDetailAfterListingMutation } from "@/app/actions/listing-detail-cache"
import { saveDefaultListingLocationAction } from "@/app/actions/sell-default-location"
import {
  validateSellListingForm,
  buildResolvedListingTitle,
  LISTING_TITLE_MAX_LENGTH,
  type BoardShippingCostMode,
  type SellFormValidationInput,
} from "@/lib/sell-form-validation"
import { LISTING_CONDITION_SELL_OPTIONS, sellFormConditionValue } from "@/lib/listing-labels"
import {
  boardDimensionDisplayFields,
  boardDimensionsToDbFields,
  formatBoardLengthForTitle,
  formatBoardLengthInputFromParts,
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
  normalizeVolumeLitersInput,
  shouldShowLengthInchHint,
} from "@/lib/board-measurements"
import {
  reswellParcelAutofillStringsFromBoard,
  reswellSuggestedShipWeightLbOzFromBoard,
} from "@/lib/surfboard-shipping-estimates"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import { SellPriceFields } from "@/components/features/sell/sell-price-fields"
import {
  DraftsPicker,
  DraftSavedStatus,
  type SellDraftItem,
} from "@/components/features/sell/drafts-picker"
import {
  SellSectionNav,
  SellSectionNavHorizontal,
  SELL_FORM_SECTION_NAV_ITEMS,
} from "@/components/features/sell/sell-section-nav"
import { computeSellSectionCompletion } from "@/lib/sell-section-completion"
import { SurfboardShippingEstimatorDialog } from "@/components/features/sell/surfboard-shipping-estimator-dialog"
import {
  boardCategoryMap,
  boardTypeFromCategoryId,
} from "@/lib/utils/board-type-from-category-id"
import {
  orderSurfboardSellCategoryOptions,
  SELL_BOARD_CATEGORY_UNSELECTED_LABEL,
  SELL_BOARD_CATEGORY_UNSELECTED_VALUE,
} from "@/lib/surfboard-sell-categories"
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"
import { upsertUserListingBoardModelDataFromSellForm } from "@/lib/db/user-listing-board-model-data"
import {
  readSellListingAreaPrefillFromSession,
  writeSellListingAreaPrefillToSession,
} from "@/lib/utils/sell-listing-area-prefill-session"
import type { LocationPrefillSuggested } from "@/components/location-picker"
import type { SellListingAreaPrefillCityState } from "@/lib/db/sell-listing-area-prefill"

/** True once the seller has pinned the board (coordinates used for drafts + validation). */
function sellFormHasCommittedMapPins(fd: { locationLat: number; locationLng: number }): boolean {
  const lat = fd.locationLat
  const lng = fd.locationLng
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false
  return true
}

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

/** Server-side Klaviyo “Listing” metric; safe to fire-and-forget from /sell after the listing is live. */
function requestKlaviyoListingCreated(listingId: string): void {
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
}

function SellFormSection({
  title,
  children,
  description,
  sectionId,
}: {
  title: string
  children: React.ReactNode
  description?: string
  /** Anchor id for in-page navigation (sell section stepper). */
  sectionId?: string
}) {
  return (
    <section
      id={sectionId}
      className={cn(
        "space-y-3 lg:space-y-4",
        sectionId && "scroll-mt-24",
      )}
    >
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground lg:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground/45 mt-1 lg:text-base lg:mt-1.5">{description}</p>
        ) : null}
      </div>
      <Card className="shadow-sm hover:shadow-sm lg:shadow-md">
        <CardContent className="p-6 lg:p-8 xl:p-10">{children}</CardContent>
      </Card>
    </section>
  )
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

/**
 * Remembers decoded thumbnails per slot across reorder/remount (dnd-kit). Without this,
 * `thumbLoaded` resets while Next/Image often skips `onLoadingComplete` for cached assets,
 * so tiles stay on the skeleton indefinitely after drag.
 */
const sellListingThumbLoadedSrcByClientId = new Map<string, string>()

/** Photos can be written to `listing_images` for a server draft row. */
function listingPhotosReadyForDraftSync(slots: ListingPhotoSlot[]): boolean {
  return (
    slots.length > 0 &&
    slots.every((im) => im.uploadPhase === "done" && Boolean(im.url?.trim()))
  )
}

function SellListingPhotoSortableTile({
  image,
  index,
  onRemove,
  onRetry,
}: {
  image: ListingPhotoSlot
  index: number
  onRemove: () => void
  onRetry: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: image.clientId,
    /** Avoid FLIP transitions fighting layout measurement with `next/image` in the tile. */
    transition: null,
  })

  return (
    <SellListingPhotoTile
      image={image}
      index={index}
      onRemove={onRemove}
      onRetry={onRetry}
      sortable={{
        setNodeRef,
        style: {
          transform: CSS.Transform.toString(transform),
          transition,
        },
        attributes,
        listeners,
        isDragging,
      }}
    />
  )
}

function SellListingPhotoTile({
  image,
  index,
  onRemove,
  onRetry,
  sortable,
}: {
  image: ListingPhotoSlot
  index: number
  onRemove: () => void
  onRetry: () => void
  /** Pointer + touch drag-to-reorder (@dnd-kit). */
  sortable: {
    setNodeRef: (node: HTMLElement | null) => void
    style: React.CSSProperties
    attributes: DraggableAttributes
    listeners: DraggableSyntheticListeners | undefined
    isDragging: boolean
  }
}) {
  const isFailure =
    image.optimizePhase === "error" || image.uploadPhase === "error"

  const remote =
    image.uploadPhase === "done"
      ? (image.thumbnailUrl?.trim() || image.url?.trim() || "").trim()
      : ""
  const photoReady = Boolean(remote)

  const thumbSrc = remote ? proxiedListingImageSrc(remote) : ""

  const persistedThumbMatches =
    thumbSrc !== "" &&
    sellListingThumbLoadedSrcByClientId.get(image.clientId) === thumbSrc

  const [thumbLoaded, setThumbLoaded] = useState(persistedThumbMatches)

  useEffect(() => {
    const matched =
      thumbSrc !== "" &&
      sellListingThumbLoadedSrcByClientId.get(image.clientId) === thumbSrc
    setThumbLoaded(matched)
  }, [image.clientId, thumbSrc])

  const skeletonVisible =
    !isFailure &&
    (!photoReady || !thumbLoaded)

  return (
    <div
      ref={sortable.setNodeRef}
      style={sortable.style}
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden bg-muted flex flex-col border border-transparent touch-none",
        sortable.isDragging && "z-[60] opacity-70 shadow-lg ring-2 ring-primary/40 scale-[1.02]",
        !isFailure && !skeletonVisible && "cursor-grab active:cursor-grabbing",
      )}
      aria-busy={!isFailure && (!photoReady || !thumbLoaded) ? true : undefined}
      aria-live="polite"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <div className="relative flex-1 min-h-0">
        {thumbSrc ? (
          <Image
            src={thumbSrc}
            alt={`Photo ${index + 1}`}
            fill
            className={cn(
              "object-cover object-center transition-opacity duration-500 ease-out motion-reduce:duration-150",
              thumbLoaded ? "opacity-100" : "opacity-0",
            )}
            unoptimized
            onLoadingComplete={() => {
              sellListingThumbLoadedSrcByClientId.set(image.clientId, thumbSrc)
              setThumbLoaded(true)
            }}
          />
        ) : null}
        {!isFailure ? (
          <div
            className={cn(
              "skeleton pointer-events-none absolute inset-0 z-[1] rounded-lg motion-reduce:[animation-duration:1ms]",
              skeletonVisible ? "opacity-100" : "opacity-0 transition-opacity duration-500 ease-out motion-reduce:duration-150 motion-reduce:transition-none",
            )}
            aria-hidden
          />
        ) : null}
        {!isFailure ? (
          <>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onRemove}
              className={cn(
                "absolute top-1 right-1 p-1 rounded-full hover:bg-background z-[5]",
                skeletonVisible
                  ? "bg-background/90 shadow-sm ring-1 ring-black/5"
                  : "bg-background/80",
              )}
              aria-label={`Remove photo ${index + 1}`}
            >
              <X className="h-3 w-3" />
            </button>
            {skeletonVisible ? (
              <span className="sr-only">
                {photoReady ? "Loading thumbnail preview" : "Processing photo"}
              </span>
            ) : (
              <>
                <div className="absolute bottom-6 left-1 flex items-center gap-1 z-[5] pointer-events-none">
                  {index === 0 ? (
                    <span className="text-[10px] bg-primary text-primary-foreground px-1 rounded">
                      Main
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
      {isFailure ? (
        <div className="shrink-0 p-1 bg-destructive/10 border-t border-destructive/20 space-y-1">
          <p className="text-[9px] text-destructive line-clamp-2">
            {image.errorMessage || "Failed"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 w-full text-[10px] px-1"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRetry}
          >
            <RefreshCw className="h-3 w-3 mr-0.5" />
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function shippingPriceToFormValue(v: unknown): string {
  if (v == null || v === "") return ""
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""))
  if (!Number.isFinite(n)) return ""
  return String(n)
}

function sellFormStateFromIdbSnapshot(
  snapshot: SellListingDraftFormSnapshot,
): ReturnType<typeof createInitialSellFormData> {
  return {
    ...createInitialSellFormData(),
    ...snapshot,
  } as ReturnType<typeof createInitialSellFormData>
}

function createInitialSellFormData() {
  return {
    title: "",
    description: "",
    price: "",
    sellerPurchasePrice: "",
    category: "",
    condition: "",
    brand: "",
    boardFulfillment: "pickup_only" as BoardFulfillmentChoice,
    boardShippingCostMode: "reswell" as BoardShippingCostMode,
    boardShippingPrice: "",
    reswellPackageLengthIn: "",
    reswellPackageWidthIn: "",
    reswellPackageHeightIn: "",
    reswellPackageWeightLb: "",
    reswellPackageWeightOz: "",
    autoPriceDrop: false,
    autoPriceDropFloor: "",
    buyerOffers: true,
    boardType: "",
    boardLength: "",
    boardWidthInches: "",
    boardThicknessInches: "",
    boardVolumeL: "",
    boardSkipOptionalDimensions: false,
    boardFins: "",
    boardTail: "",
    boardBrandId: "",
    boardIndexBrandSlug: "",
    boardIndexModelSlug: "",
    boardIndexLabel: "",
    boardModelName: "",
    boardLinkedBrandName: "",
    locationLat: 0,
    locationLng: 0,
    locationCity: "",
    locationState: "",
    locationDisplay: "",
  }
}

function boardCatalogSnapshotFromSellForm(
  form: ReturnType<typeof createInitialSellFormData>,
): SellFormBoardCatalogSlice {
  return {
    boardLength: form.boardLength,
    boardWidthInches: form.boardWidthInches,
    boardThicknessInches: form.boardThicknessInches,
    boardVolumeL: form.boardVolumeL,
    boardBrandId: form.boardBrandId,
    boardIndexBrandSlug: form.boardIndexBrandSlug,
    boardIndexModelSlug: form.boardIndexModelSlug,
    boardIndexLabel: form.boardIndexLabel,
    boardModelName: form.boardModelName,
    category: form.category,
    condition: form.condition,
    brand: form.brand,
    price: form.price,
    boardFins: form.boardFins,
  }
}

/** While set, IndexedDB restore must not run — coordinates with `clearSellListingDraft` after `?new=1`. */
const SELL_SUPPRESS_IDB_RESTORE_KEY = "reswell.sell.suppressIdbRestoreOnce"

type SellPageContentProps = {
  editId: string | null
  startFresh: boolean
  /** Resolved on the server for signed-in users to avoid CLS from client-fetch prefill */
  initialSellListingAreaPrefill: SellListingAreaPrefillCityState
  /** SSR draft list rows — avoids empty→filled jump on /sell header */
  initialSellDrafts: SellDraftItem[]
}

function listingLocationPrefillHintFromSellAreaPrefill(
  editIdProp: string | null,
  prefill: SellListingAreaPrefillCityState,
): LocationPrefillSuggested | null {
  if (editIdProp) return null
  if (!prefill?.city?.trim()) return null
  const city = prefill.city.trim()
  const state = prefill.state?.trim() ?? ""
  return {
    city,
    state,
    displayLabel: [city, state].filter(Boolean).join(", "),
  }
}

function SellPageContentInner({
  editId,
  startFresh,
  initialSellListingAreaPrefill,
  initialSellDrafts,
}: SellPageContentProps) {
  const listingPhotosInputId = useId()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  /** Start blank: clear session hint only (no auto-redirect — avoids loading flash). */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    if (startFresh) {
      clearSellServerDraftListingId()
      try {
        sessionStorage.setItem(SELL_SUPPRESS_IDB_RESTORE_KEY, "1")
      } catch {
        /* quota / private mode */
      }
      router.replace("/sell")
    }
  }, [startFresh, router])

  const [impersonation, setImpersonation] = useState<ImpersonationData | null>(null)
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  useEffect(() => {
    clearImpersonationStorageIfCookieMissing()
    setImpersonation(getImpersonation())
  }, [])

  const [loading, setLoading] = useState(false)
  const [startNewListingBusy, setStartNewListingBusy] = useState(false)
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
  /**
   * Published (or non-draft) listing edit: stepper may reflect saved data without forcing
   * “scroll + confirm location” — that rule applies to new listings and drafts only.
   */
  const skipPickupShippingStepperInteractionUx = Boolean(
    editId && typeof editListingStatus === "string" && editListingStatus !== "draft",
  )
  /** Stepper UX: require seeing the delivery section, then an explicit location pick (fires from LocationPicker only; prefills do not). */
  const [pickupShippingSectionEnteredOnce, setPickupShippingSectionEnteredOnce] = useState(false)
  const [pickupShippingLocationUserCommits, setPickupShippingLocationUserCommits] = useState(0)
  /** Profile/address suggestion only — search field UX; cleared when the user confirms or has map coords on the listing. */
  const [listingLocationPrefillHint, setListingLocationPrefillHint] =
    useState<LocationPrefillSuggested | null>(() =>
      listingLocationPrefillHintFromSellAreaPrefill(
        editId,
        initialSellListingAreaPrefill,
      ),
    )
  /** Server draft row id while staying on `/sell` (no ?edit=) — source of truth with IDB. */
  const [localServerDraftId, setLocalServerDraftId] = useState<string | null>(null)
  /** Recent drafts owned by the viewer, newest first — rendered in the DraftsPicker dropdown. */
  const [availableDrafts, setAvailableDrafts] =
    useState<SellDraftItem[]>(initialSellDrafts)
  const [draftSwitching, setDraftSwitching] = useState(false)
  const [draftSaveStatus, setDraftSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle")
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)

  const authUserIdRef = useRef<string | null>(null)
  const sellDraftUserIdRef = useRef<string | null>(null)
  const editIdRef = useRef<string | null>(editId)

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
    editIdRef.current = editId
  }, [editId])

  const prevSellEditUrlIdRef = useRef(editId)

  useEffect(() => {
    setPickupShippingSectionEnteredOnce(false)
    setPickupShippingLocationUserCommits(0)
  }, [editId, localServerDraftId])

  /** Only react to real navigations (?edit=), not the commit after first paint — avoids wiping SSR locality prefill before the user sees it. */
  useEffect(() => {
    if (prevSellEditUrlIdRef.current !== editId) {
      prevSellEditUrlIdRef.current = editId
      setListingLocationPrefillHint(null)
    }
  }, [editId])

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
  const removedImageIdsRef = useRef<string[]>([])
  useEffect(() => {
    removedImageIdsRef.current = removedImageIds
  }, [removedImageIds])
  const [shippingEstimatorOpen, setShippingEstimatorOpen] = useState(false)
  const [listingCatalogRequestVariant, setListingCatalogRequestVariant] =
    useState<ListingCatalogRequestVariant | null>(null)
  const [formData, setFormData] = useState(createInitialSellFormData)

  useEffect(() => {
    if (sellFormHasCommittedMapPins(formData)) setListingLocationPrefillHint(null)
  }, [formData.locationLat, formData.locationLng])

  const openListingCatalogRequestFromBrand = useCallback(() => {
    setListingCatalogRequestVariant("full")
  }, [])

  const openListingCatalogRequestFromModel = useCallback(() => {
    const bid = formData.boardBrandId.trim()
    setListingCatalogRequestVariant(
      bid ? { modelOnlyWithDirectoryBrandId: bid } : "full",
    )
  }, [formData.boardBrandId])

  const boardDimLengthRef = useRef<HTMLInputElement>(null)
  const boardDimWidthRef = useRef<HTMLInputElement>(null)
  const boardDimThicknessRef = useRef<HTMLInputElement>(null)
  const boardDimVolumeRef = useRef<HTMLInputElement>(null)
  const prevBoardLengthRef = useRef<string | undefined>(undefined)
  const prevBoardWidthRef = useRef<string | undefined>(undefined)
  const prevBoardThicknessRef = useRef<string | undefined>(undefined)
  const reswellWeightManualRef = useRef(false)
  /**
   * Locality prefill for /sell: `undefined` = not loaded, `null` = no profile/address hint.
   * City/region only (never street) — matches what we store after a successful publish.
   * SSR may seed this so the first paint matches DB without a Supabase round trip.
   */
  const sellLocationPrefillCacheRef = useRef<{ city: string; state: string } | null | undefined>(
    initialSellListingAreaPrefill,
  )
  const sellLocationPrefillUserIdRef = useRef<string | null>(null)

  /** SSR seeded the signed-in user's locale hint; impersonation skips location prefill altogether. */
  useLayoutEffect(() => {
    if (editId) return
    if (!getImpersonation()) return
    setListingLocationPrefillHint(null)
    sellLocationPrefillCacheRef.current = null
  }, [editId])

  const [sellCategoryOptions, setSellCategoryOptions] = useState<
    { value: string; label: string; board: boolean; slug?: string | null }[]
  >([])

  const boardCategoryOptions = useMemo(
    () => orderSurfboardSellCategoryOptions(sellCategoryOptions.filter((c) => c.board === true)),
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
  const draftImageSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftPhotosPendingRef = useRef<ListingPhotoSlot[] | null>(null)
  /** Slots from IndexedDB restore — optimized in useLayoutEffect after `optimizeAndUploadSlot` exists. */
  const idbRestoreOptimizeQueueRef = useRef<ListingPhotoSlot[] | null>(null)
  const supabaseProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, board, slug")
        .eq("board", true)
      if (cancelled) return
      if (error) return
      setSellCategoryOptions(
        (data ?? []).map((r) => ({
          value: r.id,
          label: r.name ?? "",
          board: true,
          slug: r.slug ?? null,
        })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

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
      boardModelName: formData.boardModelName,
      boardType: formData.boardType,
      boardLength: formData.boardLength,
      boardWidthInches: formData.boardWidthInches,
      boardThicknessInches: formData.boardThicknessInches,
      boardVolumeL: formData.boardVolumeL,
      boardSkipOptionalDimensions: formData.boardSkipOptionalDimensions,
      boardFins: formData.boardFins,
      boardTail: formData.boardTail,
      boardFulfillment: formData.boardFulfillment,
      boardShippingCostMode: formData.boardShippingCostMode,
      boardShippingPrice: formData.boardShippingPrice,
      reswellPackageLengthIn: formData.reswellPackageLengthIn,
      reswellPackageWidthIn: formData.reswellPackageWidthIn,
      reswellPackageHeightIn: formData.reswellPackageHeightIn,
      reswellPackageWeightLb: formData.reswellPackageWeightLb,
      reswellPackageWeightOz: formData.reswellPackageWeightOz,
      autoPriceDrop: formData.autoPriceDrop,
      autoPriceDropFloor: formData.autoPriceDropFloor,
      locationCity: formData.locationCity,
      locationState: formData.locationState,
    }),
    [formData],
  )

  const imagesUploadReady = useMemo(
    () =>
      !images.some(
        (im) =>
          im.uploadPhase !== "done" || !im.url?.trim() || !im.thumbnailUrl?.trim(),
      ),
    [images],
  )

  const sellSectionCompletionBase = useMemo(
    () =>
      computeSellSectionCompletion(sellValidationForm, {
        imageCount: images.length,
        imagesUploadReady,
      }),
    [sellValidationForm, images.length, imagesUploadReady],
  )

  const pickupShippingStepperUxSatisfied =
    skipPickupShippingStepperInteractionUx ||
    (pickupShippingSectionEnteredOnce && pickupShippingLocationUserCommits > 0)

  const sellSectionCompletion = useMemo(() => {
    const deliveryDataComplete = sellSectionCompletionBase["sell-section-delivery"] === true
    return {
      ...sellSectionCompletionBase,
      "sell-section-delivery": deliveryDataComplete && pickupShippingStepperUxSatisfied,
    }
  }, [pickupShippingStepperUxSatisfied, sellSectionCompletionBase])

  useEffect(() => {
    if (skipPickupShippingStepperInteractionUx || editLoading) return

    let cancelled = false
    let raf = 0
    let attempts = 0
    let detach: (() => void) | undefined

    const attach = () => {
      if (cancelled) return
      const el = document.getElementById("sell-section-delivery")
      if (!el) {
        attempts += 1
        if (attempts > 150) return
        raf = window.requestAnimationFrame(attach)
        return
      }

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting && e.intersectionRatio >= 0.1) {
              setPickupShippingSectionEnteredOnce(true)
              return
            }
          }
        },
        { threshold: [0, 0.1, 0.2], rootMargin: "0px 0px -6% 0px" },
      )
      io.observe(el)
      const onFocusIn = () => {
        setPickupShippingSectionEnteredOnce(true)
      }
      el.addEventListener("focusin", onFocusIn, true)
      detach = () => {
        io.disconnect()
        el.removeEventListener("focusin", onFocusIn, true)
      }
    }

    attach()
    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      detach?.()
    }
  }, [editLoading, skipPickupShippingStepperInteractionUx])
  const resolvedTitlePreview = useMemo(
    () => buildResolvedListingTitle(sellValidationForm),
    [sellValidationForm],
  )

  const deliveryFlags = useMemo(
    () => flagsFromBoardFulfillment(formData.boardFulfillment),
    [formData.boardFulfillment],
  )

  /** Reswell parcel L/W/H mirror the Dimensions section live while Reswell shipping is on (deps only dimension fields). */
  useEffect(() => {
    if (!deliveryFlags.shipping_available || formData.boardShippingCostMode !== "reswell") {
      return
    }

    const parcelFill = reswellParcelAutofillStringsFromBoard({
      boardLength: formData.boardLength,
      boardWidthInches: formData.boardWidthInches,
      boardThicknessInches: formData.boardThicknessInches,
      boardSkipOptionalDimensions: formData.boardSkipOptionalDimensions,
    })
    if (!parcelFill) return

    setFormData((fd) => {
      if (!flagsFromBoardFulfillment(fd.boardFulfillment).shipping_available) return fd
      if (fd.boardShippingCostMode !== "reswell") return fd
      if (
        fd.reswellPackageLengthIn === parcelFill.length &&
        fd.reswellPackageWidthIn === parcelFill.width &&
        fd.reswellPackageHeightIn === parcelFill.height
      ) {
        return fd
      }
      return {
        ...fd,
        reswellPackageLengthIn: parcelFill.length,
        reswellPackageWidthIn: parcelFill.width,
        reswellPackageHeightIn: parcelFill.height,
      }
    })
  }, [
    deliveryFlags.shipping_available,
    formData.boardShippingCostMode,
    formData.boardSkipOptionalDimensions,
    formData.boardLength,
    formData.boardWidthInches,
    formData.boardThicknessInches,
  ])

  useEffect(() => {
    if (!deliveryFlags.shipping_available || formData.boardShippingCostMode !== "reswell") {
      reswellWeightManualRef.current = false
      return
    }

    const weightSugg = reswellSuggestedShipWeightLbOzFromBoard({
      boardLength: formData.boardLength,
      boardVolumeL: formData.boardVolumeL,
    })

    if (!weightSugg || reswellWeightManualRef.current) return

    setFormData((fd) => {
      if (!flagsFromBoardFulfillment(fd.boardFulfillment).shipping_available) return fd
      if (fd.boardShippingCostMode !== "reswell") return fd
      const curLb = fd.reswellPackageWeightLb.trim()
      const curOz = fd.reswellPackageWeightOz.trim()
      if (curLb === weightSugg.lb && curOz === weightSugg.oz) return fd
      return {
        ...fd,
        reswellPackageWeightLb: weightSugg.lb,
        reswellPackageWeightOz: weightSugg.oz,
      }
    })
  }, [
    deliveryFlags.shipping_available,
    formData.boardShippingCostMode,
    formData.boardLength,
    formData.boardVolumeL,
  ])

  const reloadDeferredDraftHints = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    authUserIdRef.current = uid
    sellDraftUserIdRef.current = uid
    if (!user) {
      setAvailableDrafts([])
      return
    }
    const res = await fetch("/api/listings/draft", { credentials: "include" })
    if (!res.ok) {
      setAvailableDrafts([])
      return
    }
    const json = (await res.json()) as {
      data?: { drafts?: SellDraftItem[] }
    }
    const drafts = Array.isArray(json?.data?.drafts) ? json!.data!.drafts! : []
    setAvailableDrafts(drafts)
  }, [supabase])

  const applySellLocationPrefillIfEmpty = useCallback(async () => {
    if (editId) return
    if (getImpersonation()) return
    const { data: sess } = await supabase.auth.getSession()
    let userId = sess.session?.user?.id ?? null
    if (!userId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userId = user?.id ?? null
    }
    if (!userId) return

    if (sellLocationPrefillUserIdRef.current !== userId) {
      sellLocationPrefillUserIdRef.current = userId
      sellLocationPrefillCacheRef.current = undefined
    }

    if (sellLocationPrefillCacheRef.current === undefined) {
      const warmed = readSellListingAreaPrefillFromSession(userId)
      if (warmed?.city) {
        sellLocationPrefillCacheRef.current = warmed
      } else {
        const [{ data: profile }, { data: addr }] = await Promise.all([
          supabase
            .from("profiles")
            .select("default_listing_city, default_listing_state")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("addresses")
            .select("city, state")
            .eq("profile_id", userId)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
        ])
        const row = profile as {
          default_listing_city?: string | null
          default_listing_state?: string | null
        } | null
        let city = row?.default_listing_city?.trim() ?? ""
        let state = row?.default_listing_state?.trim() ?? ""
        const a = addr as { city?: string | null; state?: string | null } | null
        if (!city && a?.city?.trim()) {
          city = a.city.trim()
          state = a.state?.trim() ?? ""
        }
        const hinted = city ? { city, state: state || "" } : null
        sellLocationPrefillCacheRef.current = hinted
        writeSellListingAreaPrefillToSession(userId, hinted)
      }
    }
    const hint = sellLocationPrefillCacheRef.current
    if (!hint?.city) {
      setListingLocationPrefillHint(null)
      return
    }
    const snapshot = sellDraftLatestRef.current.formData as ReturnType<
      typeof createInitialSellFormData
    >
    if (sellFormHasCommittedMapPins(snapshot)) {
      setListingLocationPrefillHint(null)
      return
    }
    if (
      String(snapshot.locationCity ?? "").trim() ||
      String(snapshot.locationDisplay ?? "").trim()
    ) {
      setListingLocationPrefillHint(null)
      return
    }
    setListingLocationPrefillHint({
      city: hint.city,
      state: hint.state,
      displayLabel: [hint.city, hint.state].filter(Boolean).join(", "),
    })
  }, [editId, supabase])

  /**
   * `/sell?new=1` — blank form; existing server draft row (if any) stays in the dropdown.
   * Depends on `startFresh` (boolean), not the `searchParams` object identity — unstable
   * param references otherwise re-trigger this reset during photo upload.
   */
  useEffect(() => {
    if (!startFresh) return
    for (const im of imagesRef.current) {
      if (im.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(im.previewUrl)
    }
    draftPhotosPendingRef.current = null
    setFormData(createInitialSellFormData())
    sellListingThumbLoadedSrcByClientId.clear()
    setImages([])
    setRemovedImageIds([])
    setPublishPreview(null)
    setDescriptionGenerated(false)
    setLocalServerDraftId(null)
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) await clearSellListingDraft(user.id)
      try {
        sessionStorage.removeItem(SELL_SUPPRESS_IDB_RESTORE_KEY)
      } catch {
        /* ignore */
      }
    })()
    clearSellServerDraftListingId()
    clearRemoteResumeDraftIdStorage()
    void reloadDeferredDraftHints()
  }, [startFresh, reloadDeferredDraftHints, supabase])

  type PersistDraftResult = { ok: false } | { ok: true; listingId: string }

  const persistServerDraft = useCallback(
    async (opts?: { keepalive?: boolean }): Promise<PersistDraftResult> => {
      if (!draftHydrated) return { ok: false }
      if (editLoading) return { ok: false }
      if (getImpersonation()) return { ok: false }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return { ok: false }
      if (editId && !listingIsDraft) return { ok: false }
      const hasDraftableContent =
        images.length > 0 ||
        sellDraftFormLooksFilled(formData as SellListingDraftFormSnapshot)
      if (!hasDraftableContent) return { ok: false }
      const body = {
        listingId: editId ?? localServerDraftId,
        title: formData.title,
        description: formData.description,
        price: formData.price,
        sellerPurchasePrice: formData.sellerPurchasePrice,
        condition: formData.condition,
        category: formData.category,
        brand: formData.brand,
        boardFulfillment: formData.boardFulfillment,
        boardShippingCostMode: formData.boardShippingCostMode,
        boardShippingPrice: formData.boardShippingPrice,
        reswellPackageLengthIn: formData.reswellPackageLengthIn,
        reswellPackageWidthIn: formData.reswellPackageWidthIn,
        reswellPackageHeightIn: formData.reswellPackageHeightIn,
        reswellPackageWeightLb: formData.reswellPackageWeightLb,
        reswellPackageWeightOz: formData.reswellPackageWeightOz,
        autoPriceDrop: formData.autoPriceDrop,
        autoPriceDropFloor: formData.autoPriceDropFloor,
        buyerOffers: formData.buyerOffers,
        boardType: formData.boardType,
        boardLength: formData.boardLength,
        boardWidthInches: formData.boardWidthInches,
        boardThicknessInches: formData.boardThicknessInches,
        boardVolumeL: formData.boardVolumeL,
        boardSkipOptionalDimensions: formData.boardSkipOptionalDimensions,
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
      setDraftSaveStatus("saving")
      const res = await fetch("/api/listings/draft", init)
      if (!res.ok) {
        if (res.status === 404 || res.status === 403) {
          clearSellServerDraftListingId()
          clearRemoteResumeDraftIdStorage()
          setLocalServerDraftId(null)
        }
        setDraftSaveStatus("error")
        return { ok: false }
      }
      const json = (await res.json()) as { data?: { id?: string } }
      const id = json?.data?.id
      const resolvedId =
        typeof id === "string" && id
          ? id
          : editId ?? localServerDraftId ?? ""
      if (!resolvedId) {
        setDraftSaveStatus("error")
        return { ok: false }
      }
      setSellServerDraftListingId(resolvedId)
      const wasNewDraft = !editId && !localServerDraftId
      setLocalServerDraftId(resolvedId)
      setDraftSaveStatus("saved")
      setDraftSavedAt(Date.now())
      if (wasNewDraft) {
        // New draft row appeared — refresh the picker so the user sees it listed.
        void reloadDeferredDraftHints()
      }
      return { ok: true, listingId: resolvedId }
    },
    [
      draftHydrated,
      editId,
      localServerDraftId,
      formData,
      images.length,
      listingIsDraft,
      supabase,
      editLoading,
      reloadDeferredDraftHints,
    ],
  )

  const showDraftActionButtons =
    !loading &&
    !editLoading &&
    !getImpersonation() &&
    ((Boolean(editId) && listingIsDraft) ||
      (Boolean(localServerDraftId) && !editId))

  const handleSaveDraft = useCallback(async () => {
    const hasDraftableContent =
      imagesRef.current.length > 0 ||
      sellDraftFormLooksFilled(formData as SellListingDraftFormSnapshot)
    if (!hasDraftableContent) {
      toast.message("Add at least one detail or photo before saving a draft.")
      return
    }
    const result = await persistServerDraft()
    if (!result.ok) {
      toast.error("Failed to save draft — please try again")
      return
    }
    const slots = imagesRef.current
    if (listingPhotosReadyForDraftSync(slots)) {
      try {
        const { nextSlots, didInsert } = await syncListingImagesFromSnapshotRef.current(
          result.listingId,
          slots,
          removedImageIdsRef.current,
        )
        if (didInsert) setImages(nextSlots)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Photos could not be saved to the draft."
        toast.error(msg)
        setDraftSaveStatus("error")
        return
      }
    }
    toast.success("Draft saved")
  }, [formData, persistServerDraft])

  const handleStartNewListing = useCallback(async () => {
    setStartNewListingBusy(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      for (const im of imagesRef.current) {
        if (im.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(im.previewUrl)
      }
      draftPhotosPendingRef.current = null
      setFormData(createInitialSellFormData())
      sellListingThumbLoadedSrcByClientId.clear()
      setImages([])
      setRemovedImageIds([])
      setLocalServerDraftId(null)
      setPublishPreview(null)
      setDescriptionGenerated(false)
      clearSellServerDraftListingId()
      clearRemoteResumeDraftIdStorage()
      if (user) await clearSellListingDraft(user.id)
      await reloadDeferredDraftHints()
      toast.message("Starting a new listing — your previous draft is still saved.")
      if (editId) {
        router.replace("/sell")
      }
      window.setTimeout(() => {
        void applySellLocationPrefillIfEmpty()
      }, 0)
    } finally {
      setStartNewListingBusy(false)
    }
  }, [applySellLocationPrefillIfEmpty, editId, router, reloadDeferredDraftHints, supabase])

  const currentDraftId = useMemo(() => {
    if (editId && listingIsDraft) return editId
    if (!editId && localServerDraftId) return localServerDraftId
    return null
  }, [editId, listingIsDraft, localServerDraftId])

  const handleOpenDraft = useCallback(
    async (draftId: string) => {
      if (!draftId) return
      if (draftId === currentDraftId) return
      setDraftSwitching(true)
      try {
        if (currentDraftId) {
          const persisted = await persistServerDraft()
          if (persisted.ok) {
            const slots = imagesRef.current
            if (listingPhotosReadyForDraftSync(slots)) {
              try {
                const { nextSlots, didInsert } = await syncListingImagesFromSnapshotRef.current(
                  persisted.listingId,
                  slots,
                  removedImageIdsRef.current,
                )
                if (didInsert) setImages(nextSlots)
              } catch (e) {
                if (process.env.NODE_ENV === "development") {
                  console.warn("[sell] draft image sync before switch", e)
                }
              }
            }
          }
        }
        router.push(`/sell?edit=${encodeURIComponent(draftId)}`)
      } finally {
        setDraftSwitching(false)
      }
    },
    [currentDraftId, persistServerDraft, router],
  )

  const handleDiscardDraftFromPicker = useCallback(
    async (draftId: string) => {
      if (!draftId) return
      const res = await fetch(
        `/api/listings/draft?id=${encodeURIComponent(draftId)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      )
      if (!res.ok) {
        toast.error("Could not discard draft")
        return
      }
      setAvailableDrafts((prev) => prev.filter((d) => d.id !== draftId))
      if (draftId === currentDraftId) {
        if (!editId) {
          setLocalServerDraftId(null)
          clearSellServerDraftListingId()
          clearRemoteResumeDraftIdStorage()
          setFormData(createInitialSellFormData())
          sellListingThumbLoadedSrcByClientId.clear()
          setImages([])
          setRemovedImageIds([])
          setPublishPreview(null)
          setDescriptionGenerated(false)
          const uid = sellDraftUserIdRef.current
          if (uid) await clearSellListingDraft(uid)
          window.setTimeout(() => {
            void applySellLocationPrefillIfEmpty()
          }, 0)
        } else {
          router.push("/sell")
        }
      }
    },
    [applySellLocationPrefillIfEmpty, currentDraftId, editId, router],
  )

  useEffect(() => {
    if (!editId) {
      setEditListingStatus(null)
    }
  }, [editId])

  /** Blank /sell: load draft availability; restore local IDB snapshot before hydrating so debounced persist never wipes it. */
  useEffect(() => {
    if (editId) {
      setDraftHydrated(true)
      return
    }
    let cancelled = false
    void (async () => {
      /** Capture before any await: layout may strip `?new=1` while draft hints load. */
      const wantsBlankListing =
        startFresh ||
        (typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("new") === "1")
      await reloadDeferredDraftHints()
      if (cancelled) return

      const suppressIdbForNewListing =
        typeof window !== "undefined" &&
        (() => {
          try {
            return sessionStorage.getItem(SELL_SUPPRESS_IDB_RESTORE_KEY) === "1"
          } catch {
            return false
          }
        })()

      if (
        !wantsBlankListing &&
        !suppressIdbForNewListing &&
        !getImpersonation()
      ) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!cancelled && user) {
          const record = await loadSellListingDraft(user.id)
          if (record && !cancelled) {
            setFormData(sellFormStateFromIdbSnapshot(record.formData))
            const sid = record.serverListingId?.trim()
            if (sid && /^[0-9a-f-]{36}$/i.test(sid)) {
              setLocalServerDraftId(sid)
              setSellServerDraftListingId(sid)
            }
            const blobs = Array.isArray(record.imageBlobs) ? record.imageBlobs : []
            if (blobs.length > 0) {
              const slots: ListingPhotoSlot[] = []
              for (const b of blobs) {
                try {
                  const file = new File(
                    [b.buffer],
                    b.name || "photo.jpg",
                    { type: b.type || "image/jpeg" },
                  )
                  assertListingOriginalSize(file)
                  const clientId = crypto.randomUUID()
                  const previewUrl = URL.createObjectURL(file)
                  slots.push({
                    clientId,
                    previewUrl,
                    optimizePhase: "running",
                    uploadPhase: "idle",
                    progressFull: 0,
                    progressThumb: 0,
                    sourceFile: file,
                  })
                } catch {
                  /* skip oversized / invalid blob */
                }
              }
              if (slots.length > 0) {
                idbRestoreOptimizeQueueRef.current = slots
                setImages(slots)
              }
            }
          }
        }
      }

      if (!cancelled) setDraftHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [editId, reloadDeferredDraftHints, startFresh, supabase])

  /** New listing (no ?edit=): prefill city/region from profile or saved session when empty. Runs right after hydrate (microtask ≪ setTimeout). */
  useEffect(() => {
    if (editId || !draftHydrated) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      void applySellLocationPrefillIfEmpty()
    })
    return () => {
      cancelled = true
    }
  }, [editId, draftHydrated, applySellLocationPrefillIfEmpty])

  /** Clear session draft hints when the account changes; reload /sell draft availability for the new user. */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null
      const prev = authUserIdRef.current
      if (prev !== null && uid !== null && prev !== uid) {
        writeSellListingAreaPrefillToSession(prev, null)
        clearSellServerDraftListingId()
        clearRemoteResumeDraftIdStorage()
        setLocalServerDraftId(null)
        sellLocationPrefillCacheRef.current = undefined
        sellLocationPrefillUserIdRef.current = uid
        if (!editIdRef.current) {
          void reloadDeferredDraftHints()
        }
      }
      if (uid === null) {
        if (prev) writeSellListingAreaPrefillToSession(prev, null)
        clearSellServerDraftListingId()
        clearRemoteResumeDraftIdStorage()
        setLocalServerDraftId(null)
        setAvailableDrafts([])
        sellLocationPrefillCacheRef.current = undefined
        sellLocationPrefillUserIdRef.current = null
      }
      authUserIdRef.current = uid
      sellDraftUserIdRef.current = uid
    })
    return () => subscription.unsubscribe()
  }, [supabase, reloadDeferredDraftHints])

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
          sellDraftUserIdRef.current,
        )
        if (built) await saveSellListingDraft(built)
        else {
          const uid = sellDraftUserIdRef.current
          if (uid) await clearSellListingDraft(uid)
        }
      })()
    }, 600)
    return () => {
      if (sellDraftPersistTimerRef.current) clearTimeout(sellDraftPersistTimerRef.current)
    }
  }, [editId, draftHydrated, formData, images, localServerDraftId])

  // Server draft is saved explicitly (Save draft button) or on page exit — not on every keystroke.

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
          localServerDraftIdRef.current,
          sellDraftUserIdRef.current,
        )
        if (built) await saveSellListingDraft(built)
        else {
          const uid = sellDraftUserIdRef.current
          if (uid) await clearSellListingDraft(uid)
        }
      })()
    }
    const flushAll = () => {
      flushIdb()
      void (async () => {
        const persisted = await persistServerDraftRef.current({ keepalive: true })
        if (!persisted.ok) return
        const slots = imagesRef.current
        if (!listingPhotosReadyForDraftSync(slots)) return
        try {
          const { nextSlots, didInsert } = await syncListingImagesFromSnapshotRef.current(
            persisted.listingId,
            slots,
            removedImageIdsRef.current,
          )
          if (didInsert) setImages(nextSlots)
        } catch {
          /* best-effort — page may unload mid-request */
        }
      })()
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
          listing_images (id, url, thumbnail_url, is_primary, sort_order),
          user_listing_board_model_data ( model_name, catalog_model_slug, catalog_brand_slug )
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
      const storedShipMode = (listing as { board_shipping_cost_mode?: string | null })
        .board_shipping_cost_mode
      if (
        storedShipMode === "reswell" ||
        storedShipMode === "free" ||
        storedShipMode === "flat"
      ) {
        boardShippingCostMode = storedShipMode
      } else if (
        loadedFulfillment === "shipping_only" ||
        loadedFulfillment === "pickup_and_shipping"
      ) {
        const p = listing.shipping_price
        if (p != null && p !== "") {
          const n = parseFloat(String(p).replace(/,/g, ""))
          if (Number.isFinite(n) && n > 0) boardShippingCostMode = "flat"
        }
      }
      const snapRel = (
        listing as {
          user_listing_board_model_data?:
            | {
                model_name?: string | null
                catalog_model_slug?: string | null
                catalog_brand_slug?: string | null
              }
            | {
                model_name?: string | null
                catalog_model_slug?: string | null
                catalog_brand_slug?: string | null
              }[]
            | null
        }
      ).user_listing_board_model_data
      const snapRow = Array.isArray(snapRel) ? snapRel[0] : snapRel
      const loadedBoardModelName = snapRow?.model_name?.trim() ?? ""
      const loadedCatalogModelSlug = snapRow?.catalog_model_slug?.trim() ?? ""
      const loadedCatalogBrandSlug = snapRow?.catalog_brand_slug?.trim() ?? ""

      const loadedReswellPackage = reswellPackageFormFromDbRow(
        listing as {
          shipping_packed_length_in?: number | string | null
          shipping_packed_width_in?: number | string | null
          shipping_packed_height_in?: number | string | null
          shipping_packed_weight_oz?: number | string | null
        },
      )
      const hasReswellPackageFromDb =
        loadedReswellPackage.reswellPackageLengthIn.trim() !== "" ||
        loadedReswellPackage.reswellPackageWidthIn.trim() !== "" ||
        loadedReswellPackage.reswellPackageHeightIn.trim() !== "" ||
        loadedReswellPackage.reswellPackageWeightLb.trim() !== "" ||
        loadedReswellPackage.reswellPackageWeightOz.trim() !== ""
      if (hasReswellPackageFromDb) {
        reswellWeightManualRef.current = true
      } else {
        reswellWeightManualRef.current = false
      }

      setFormData({
        title: listing.title ?? "",
        description: listing.description ?? "",
        price: String(listing.price ?? ""),
        sellerPurchasePrice: (() => {
          const v = (listing as { seller_purchase_price_usd?: number | string | null })
            .seller_purchase_price_usd
          if (v == null || v === "") return ""
          return String(v)
        })(),
        category: listing.category_id ?? "",
        condition: sellFormConditionValue(listing.condition),
        brand: (listing as { brand?: string | null }).brand?.trim() ?? "",
        boardFulfillment: loadedFulfillment,
        boardShippingCostMode,
        boardShippingPrice,
        ...(hasReswellPackageFromDb
          ? loadedReswellPackage
          : {
              reswellPackageLengthIn: "",
              reswellPackageWidthIn: "",
              reswellPackageHeightIn: "",
              reswellPackageWeightLb: "",
              reswellPackageWeightOz: "",
            }),
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
        boardSkipOptionalDimensions: (() => {
          const w = (listing as { width?: number | null }).width
          const t = (listing as { thickness?: number | null }).thickness
          return w == null && t == null
        })(),
        boardFins: (listing as { fins_setup?: string | null }).fins_setup ?? "",
        boardTail: (listing as { tail_shape?: string | null }).tail_shape ?? "",
        boardBrandId: (listing as { brand_id?: string | null }).brand_id?.trim() ?? "",
        boardIndexBrandSlug: loadedCatalogBrandSlug,
        boardIndexModelSlug: loadedCatalogModelSlug,
        boardIndexLabel: (() => {
          const b = (listing as { brand?: string | null }).brand?.trim() ?? ""
          const m = loadedBoardModelName
          if (b && m) return `${b} ${m}`.trim()
          return b || m || ""
        })(),
        boardModelName: loadedBoardModelName,
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
      sellListingThumbLoadedSrcByClientId.clear()
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

  useLayoutEffect(() => {
    const q = idbRestoreOptimizeQueueRef.current
    if (!q?.length) return
    idbRestoreOptimizeQueueRef.current = null
    for (const s of q) void optimizeAndUploadSlot(s)
  }, [draftHydrated])

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
      if (toRemove?.clientId) {
        sellListingThumbLoadedSrcByClientId.delete(toRemove.clientId)
      }
      if (toRemove?.id) {
        setRemovedImageIds((ids) => [...ids, toRemove.id!])
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const photoDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handlePhotosDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setImages((prev) => {
      const oldIndex = prev.findIndex((i) => i.clientId === active.id)
      const newIndex = prev.findIndex((i) => i.clientId === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  function listingImagesPayloadForApi(): { url: string; thumbnail_url: string | null }[] {
    return images.map((im) => ({
      url: im.url!,
      thumbnail_url: im.thumbnailUrl ?? null,
    }))
  }

  /**
   * Writes current photo URLs to `listing_images` for a draft (or live) listing.
   * Uses explicit slots + removed ids so callers can pass `imagesRef` / refs (e.g. Save draft, pagehide).
   */
  async function syncListingImagesFromSnapshot(
    listingId: string,
    slots: ListingPhotoSlot[],
    removedIds: string[],
  ): Promise<{ nextSlots: ListingPhotoSlot[]; didInsert: boolean }> {
    if (removedIds.length) {
      await supabase
        .from("listing_images")
        .delete()
        .in("id", removedIds)
        .eq("listing_id", listingId)
    }

    const newRows = slots
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

    let working = [...slots]
    if (insertResults.length) {
      for (const { index, id } of insertResults) {
        working[index] = { ...working[index], id }
      }
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

    return { nextSlots: working, didInsert: insertResults.length > 0 }
  }

  async function syncListingImages(listingId: string) {
    const { nextSlots, didInsert } = await syncListingImagesFromSnapshot(
      listingId,
      images,
      removedImageIds,
    )
    if (didInsert) setImages(nextSlots)
  }

  const syncListingImagesFromSnapshotRef = useRef(syncListingImagesFromSnapshot)
  syncListingImagesFromSnapshotRef.current = syncListingImagesFromSnapshot

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

      const sellerPurchaseRaw = submitForm.sellerPurchasePrice?.trim() ?? ""
      if (
        sellerPurchaseRaw &&
        sellerPurchasePriceToDb(submitForm.sellerPurchasePrice) === null
      ) {
        toast.error("What you paid: enter a valid dollar amount or leave it blank.")
        setLoading(false)
        return
      }

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

      const persistBoardCatalogSnapshot = (listingIdForSnap: string, sellerUserId: string) => {
        void upsertUserListingBoardModelDataFromSellForm(supabase, {
          listingId: listingIdForSnap,
          sellerUserId,
          form: boardCatalogSnapshotFromSellForm(fd),
        }).then((r) => {
          if (!r.ok && process.env.NODE_ENV === "development") {
            console.warn("[sell] user_listing_board_model_data:", r.error)
          }
        })
      }

      const fulfillmentFlags = resolveListingFulfillmentFlagsForSellSubmit(fd)

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
        board_shipping_cost_mode: fulfillmentFlags.shipping_available
          ? (fd.boardShippingCostMode ?? "reswell")
          : null,
      }

      const boardLocationLat = fd.locationLat ? fd.locationLat : null
      const boardLocationLng = fd.locationLng ? fd.locationLng : null
      const boardLocationCity = fd.locationCity.trim() || null
      const boardLocationState = fd.locationState.trim() || null

      function persistDefaultListingLocalityForProfile() {
        if (listingImpersonation) return
        if (!boardLocationCity) return
        void saveDefaultListingLocationAction({
          city: boardLocationCity,
          state: (boardLocationState ?? "").trim() || undefined,
        })
      }

      const resolvedListingTitle = buildResolvedListingTitle({
        listingType: "board",
        ...fd,
      } as SellFormValidationInput)

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
        const packedRow = reswellPackageFieldsToDb(fd)
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
          board_shipping_cost_mode: fulfillmentRow.board_shipping_cost_mode,
          ...packedRow,
          auto_price_drop_floor: fd.autoPriceDrop
            ? parseFloat(fd.autoPriceDropFloor.trim().replace(/,/g, ""))
            : null,
          buyer_offers_enabled: fd.buyerOffers !== false,
          brand: fd.brand.trim() ? fd.brand.trim() : null,
          brand_id: fd.boardBrandId.trim() || null,
          seller_purchase_price_usd: sellerPurchasePriceToDb(fd.sellerPurchasePrice),
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
          persistBoardCatalogSnapshot(effectiveEditId, user.id)
          if (publishingFromDraftRow && effectiveEditId) {
            requestKlaviyoListingCreated(effectiveEditId)
          }
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
              catalog_snapshot: boardCatalogSnapshotFromSellForm(fd),
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
        const packedRowNew = reswellPackageFieldsToDb(fd)
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
          board_shipping_cost_mode: fulfillmentRow.board_shipping_cost_mode,
          ...packedRowNew,
          auto_price_drop_floor: fd.autoPriceDrop
            ? parseFloat(fd.autoPriceDropFloor.trim().replace(/,/g, ""))
            : null,
          buyer_offers_enabled: fd.buyerOffers !== false,
          brand: fd.brand.trim() ? fd.brand.trim() : null,
          brand_id: fd.boardBrandId.trim() || null,
          seller_purchase_price_usd: sellerPurchasePriceToDb(fd.sellerPurchasePrice),
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
            body: JSON.stringify({
              listing: listingFields,
              images: imagePayload,
              catalog_snapshot: boardCatalogSnapshotFromSellForm(fd),
            }),
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
          persistBoardCatalogSnapshot(listing.id, user.id)
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
          requestKlaviyoListingCreated(String(listing.id))
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
            toast.success("Your listing is live! 🎉", { id: tid, duration: 4000 })
          } else {
            toast.success("Your listing is live! 🎉", { duration: 4000 })
          }
          void clearSellListingDraft(user.id)
          clearSellServerDraftListingId()
          clearRemoteResumeDraftIdStorage()
          setLocalServerDraftId(null)
          setAvailableDrafts((prev) => prev.filter((d) => d.id !== listingId))
          persistDefaultListingLocalityForProfile()
          await revalidateListingDetailAfterListingMutation()
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
        if (tidDone != null) toast.success(`${msg} 🎉`, { id: tidDone, duration: 4000 })
        else toast.success(msg, { duration: 4000 })
      } else {
        const msg = effectiveEditId ? "Listing updated!" : "Your listing is live! 🎉"
        if (tidDone != null) toast.success(msg, { id: tidDone, duration: 4000 })
        else
          toast.success(effectiveEditId ? "Listing updated!" : "Your listing is live! 🎉", {
            duration: 4000,
          })
      }
      void clearSellListingDraft(user.id)
      clearSellServerDraftListingId()
      clearRemoteResumeDraftIdStorage()
      setLocalServerDraftId(null)
      setAvailableDrafts((prev) => prev.filter((d) => d.id !== listingId))
      persistDefaultListingLocalityForProfile()
      await revalidateListingDetailAfterListingMutation()
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
          duration: 8000,
          description: msg,
          action: {
            label: "Retry",
            onClick: () => formRef.current?.requestSubmit(),
          },
        })
      } else {
        toast.error(msg, {
          duration: 8000,
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
      <main className="flex-1 w-full bg-muted pt-8 pb-16 md:pb-20 lg:pb-24">
        <div className="container mx-auto max-w-2xl lg:max-w-6xl">
          <h1 className="sr-only">
            {editId
              ? listingIsDraft
                ? "Continue your listing"
                : "Edit listing"
              : "Create a Listing"}
          </h1>
          <div className="border-t border-neutral-200 pt-4 pb-8 mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <Breadcrumb>
                <BreadcrumbList className="gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                      <Link href="/">Home</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                      <Link href="/listings">Listings</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-normal text-[#5c6b89]">
                      {editId
                        ? listingIsDraft
                          ? "Continue your listing"
                          : "Edit listing"
                        : "Create a Listing"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3 shrink-0">
                {!editLoading &&
                  (!editId || listingIsDraft) &&
                  !getImpersonation() && (
                    <div className="flex items-center gap-3">
                      {showDraftActionButtons && (
                        <DraftSavedStatus
                          status={draftSaveStatus}
                          savedAt={draftSavedAt}
                        />
                      )}
                      <DraftsPicker
                        drafts={availableDrafts}
                        currentDraftId={currentDraftId}
                        onSelect={(id) => void handleOpenDraft(id)}
                        onDiscard={handleDiscardDraftFromPicker}
                        onSaveDraft={() => void handleSaveDraft()}
                        saveDraftBusy={draftSaveStatus === "saving"}
                        onStartNew={
                          showDraftActionButtons
                            ? () => void handleStartNewListing()
                            : undefined
                        }
                        disabled={
                          loading ||
                          startNewListingBusy ||
                          draftSwitching ||
                          boardCategoryOptions.length === 0 ||
                          optimizingAny ||
                          !draftHydrated
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Exit listing form"
                        asChild
                      >
                        <Link href="/listings">
                          <X className="h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {editLoading ? (
            <div className="flex items-center justify-center py-16 rounded-xl border border-border bg-card shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-10 xl:gap-14">
              <div className="hidden shrink-0 lg:block lg:w-52 xl:w-56">
                <SellSectionNav
                  items={SELL_FORM_SECTION_NAV_ITEMS}
                  sectionCompletion={sellSectionCompletion}
                />
              </div>
              <div className="min-w-0 w-full max-w-2xl lg:max-w-3xl">
                <SellSectionNavHorizontal
                  items={SELL_FORM_SECTION_NAV_ITEMS}
                  sectionCompletion={sellSectionCompletion}
                  className="mb-8 hidden md:block lg:hidden"
                />
                <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="space-y-10 lg:space-y-12"
              aria-busy={loading}
            >
                <SellFormSection
                  sectionId="sell-section-photos-title"
                  title="Title & photos"
                  description="Write a title in your own words — it’s what buyers see first and what we use in the link. Add clear photos of your board."
                >
                <div className="space-y-8">
                  <div className="space-y-2">
                      <div className="flex items-end justify-between gap-2">
                        <Label htmlFor="listing-title">Title *</Label>
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            resolvedTitlePreview.length > LISTING_TITLE_MAX_LENGTH
                              ? "font-medium text-destructive"
                              : "text-muted-foreground/45",
                          )}
                          aria-live="polite"
                        >
                          {resolvedTitlePreview.length}/{LISTING_TITLE_MAX_LENGTH}
                        </span>
                      </div>
                      <Input
                        id="listing-title"
                        className="placeholder:text-muted-foreground/45"
                        placeholder={`e.g., 6'0 CI Rookie — light use, fins included`}
                        value={formData.title}
                        onChange={(e) =>
                          setFormData((f) => ({ ...f, title: e.target.value }))
                        }
                        autoComplete="off"
                        required
                        maxLength={LISTING_TITLE_MAX_LENGTH}
                      />
                  </div>

                  <Separator className="bg-border" />

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Photos</h3>
                    <p className="text-xs text-muted-foreground/45">
                      Drag photos to reorder — the first is your main image.
                    </p>
                  <Label className="sr-only">Listing photos</Label>
                  <DndContext
                    sensors={photoDragSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handlePhotosDragEnd}
                  >
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    <SortableContext
                      items={images.map((im) => im.clientId)}
                      strategy={rectSortingStrategy}
                    >
                    {images.map((image, index) => (
                      <SellListingPhotoSortableTile
                        key={image.clientId}
                        image={image}
                        index={index}
                        onRemove={() => removeImage(index)}
                        onRetry={() => retryListingPhotoUpload(image.clientId)}
                      />
                    ))}
                    </SortableContext>
                    {images.length < 12 && (
                      <div className="relative aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors overflow-hidden">
                        <label
                          htmlFor={listingPhotosInputId}
                          className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                        >
                          <span className="sr-only">Add listing photos</span>
                          <Upload className="h-6 w-6 text-muted-foreground/45 pointer-events-none" aria-hidden />
                          <span className="text-xs text-muted-foreground/45 mt-1 pointer-events-none" aria-hidden>
                            Add
                          </span>
                        </label>
                        <input
                          id={listingPhotosInputId}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageChange}
                          className="sr-only"
                        />
                      </div>
                    )}
                  </div>
                  </DndContext>
                  <p className="text-xs text-muted-foreground/45 space-y-1">
                    <span className="block">Thank you for listing on Reswell.</span>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span>Made with</span>
                      <Heart
                        className="h-4 w-4 shrink-0 fill-red-500 text-red-500"
                        aria-hidden
                      />
                      <span>in Santa Barbara.</span>
                    </span>
                  </p>
                  </div>
                </div>
                </SellFormSection>

                <SellFormSection
                  sectionId="sell-section-board"
                  title="Board shape, dimensions & description"
                >
                    <div className="space-y-8">
                      <div className="space-y-2">
                        <Label>Board shape / category *</Label>
                        <Select
                          value={
                            formData.category.trim()
                              ? formData.category
                              : SELL_BOARD_CATEGORY_UNSELECTED_VALUE
                          }
                          disabled={editLoading}
                          onValueChange={(value) => {
                            if (value === SELL_BOARD_CATEGORY_UNSELECTED_VALUE) {
                              setFormData((prev) => ({
                                ...prev,
                                category: "",
                                boardType: "",
                              }))
                              return
                            }
                            setFormData((prev) => ({
                              ...prev,
                              category: value,
                              boardType: boardTypeFromCategoryId(value),
                            }))
                          }}
                        >
                          <SelectTrigger aria-label="Board shape or category">
                            <SelectValue placeholder={SELL_BOARD_CATEGORY_UNSELECTED_LABEL} />
                          </SelectTrigger>
                          <SelectContent>
                            {boardCategoryOptions.length === 0 ? (
                              <SelectItem value="__loading__" disabled>
                                {sellCategoryOptions.length === 0
                                  ? "Loading categories…"
                                  : "No board categories found — add rows with board = true in public.categories."}
                              </SelectItem>
                            ) : (
                              <>
                                <SelectItem value={SELL_BOARD_CATEGORY_UNSELECTED_VALUE}>
                                  {SELL_BOARD_CATEGORY_UNSELECTED_LABEL}
                                </SelectItem>
                                {boardCategoryOptions.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="max-w-md space-y-2">
                        <Label htmlFor="sell-condition">Condition *</Label>
                        <Select
                          value={formData.condition}
                          onValueChange={(value) => setFormData({ ...formData, condition: value })}
                        >
                          <SelectTrigger id="sell-condition">
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

                      <Separator className="bg-border" />

                      {/* Brand, model & dimensions — one zone; divider separates from shape / condition */}
                      <div className="space-y-4">
                        <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
                          <div className="min-w-0 space-y-2">
                            <div className="flex items-end justify-between gap-2">
                              <Label htmlFor="listing-brand">Brand *</Label>
                            </div>
                            <SurfboardTitleIndexInput
                              id="listing-brand"
                              placeholder="e.g., Channel Islands"
                              value={formData.brand}
                              committedDirectoryBrandLabel={
                                formData.boardBrandId
                                  ? formData.boardLinkedBrandName.trim() ||
                                    formData.brand.trim() ||
                                    null
                                  : null
                              }
                              onChange={(v) => {
                                setFormData((f) => {
                                  const clear =
                                    f.boardBrandId &&
                                    f.boardLinkedBrandName &&
                                    v.trim() !== f.boardLinkedBrandName.trim()
                                  if (!clear) return { ...f, brand: v }
                                  return {
                                    ...f,
                                    brand: v,
                                    boardBrandId: "",
                                    boardIndexBrandSlug: "",
                                    boardIndexModelSlug: "",
                                    boardIndexLabel: "",
                                    boardModelName: "",
                                    boardLinkedBrandName: "",
                                  }
                                })
                              }}
                              boardLength={boardLengthFormatted}
                              onSelectModel={(opt: IndexBoardModelSelection) => {
                                const modelFromCatalog =
                                  opt.modelName.trim() ||
                                  (opt.modelSlug.trim() ? opt.label.trim() : "")
                                setFormData((f) => ({
                                  ...f,
                                  boardBrandId: opt.brandId,
                                  boardIndexBrandSlug: opt.brandSlug,
                                  boardIndexModelSlug: opt.modelSlug,
                                  boardIndexLabel: opt.label,
                                  boardModelName: modelFromCatalog,
                                  brand: opt.brandName,
                                  boardLinkedBrandName: opt.brandName,
                                }))
                              }}
                              onRequestBrand={openListingCatalogRequestFromBrand}
                              required
                            />
                            <div className="space-y-1.5">
                              <button
                                type="button"
                                className="text-left text-xs text-primary hover:text-primary/90"
                                onClick={openListingCatalogRequestFromBrand}
                              >
                                Brand not listed? Request we add it
                              </button>
                            </div>
                          </div>

                          <div className="min-w-0 space-y-2">
                            <SellBoardModelField
                              linkedBrandDisplayName={
                                formData.boardLinkedBrandName.trim() || formData.brand.trim()
                              }
                              modelName={formData.boardModelName}
                              modelCatalogSlug={formData.boardIndexModelSlug}
                              boardIndexBrandSlug={formData.boardIndexBrandSlug}
                              onCatalogModelChange={(patch) =>
                                setFormData((f) => ({
                                  ...f,
                                  ...patch,
                                }))
                              }
                              disabled={editLoading}
                              onRequestCatalogAdd={openListingCatalogRequestFromModel}
                            />
                            <div className="space-y-1.5">
                              <button
                                type="button"
                                className="text-left text-xs text-primary hover:text-primary/90"
                                onClick={openListingCatalogRequestFromModel}
                              >
                                Model not listed? Request we add it
                              </button>
                            </div>
                          </div>
                        </div>
                        <RequestBrandModelDialog
                          open={listingCatalogRequestVariant !== null}
                          onOpenChange={(next) => {
                            if (!next) setListingCatalogRequestVariant(null)
                          }}
                          variant={listingCatalogRequestVariant ?? "full"}
                          defaultBrandName={formData.boardLinkedBrandName.trim() || formData.brand.trim()}
                          defaultModelName={formData.boardModelName.trim()}
                          onBrandSubmitted={(brandName) => {
                            setFormData((f) => ({
                              ...f,
                              brand: brandName,
                              boardBrandId: "",
                              boardIndexBrandSlug: "",
                              boardIndexModelSlug: "",
                              boardIndexLabel: "",
                              boardModelName: "",
                              boardLinkedBrandName: "",
                            }))
                          }}
                        />
                        <p className="text-xs text-muted-foreground/45">
                          {
                            "Brand and model don't appear on your listing. We use them to match your board to search and filters so surfers can find it."
                          }
                        </p>
                      </div>

                      <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {/* Length */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground/45">Length *</Label>
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                "flex min-h-10 min-w-0 max-w-[11rem] flex-1 items-center justify-center gap-0.5 rounded-md border border-input bg-background px-1.5 shadow-sm ring-offset-background",
                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                              )}
                            >
                              <Input
                                ref={boardDimLengthRef}
                                type="text"
                                inputMode="text"
                                placeholder="6'2"
                                value={formData.boardLength}
                                onChange={(e) => {
                                  const next = normalizeBoardLengthInput(e.target.value)
                                  prevBoardLengthRef.current = next
                                  setFormData((fd) => ({ ...fd, boardLength: next }))
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-base shadow-none tabular-nums placeholder:text-muted-foreground/45 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
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
                                <span id="sell-length-inches-hint-sr" className="sr-only">
                                  {`Then type inches after the apostrophe (for example six foot two as 6'2).`}
                                </span>
                              ) : null}
                            </div>
                            {/* Reserve same width as &quot;in&quot; / &quot;L&quot; on other rows so the input matches on narrow screens */}
                            <span
                              className="inline-flex w-5 shrink-0 items-center justify-center text-xs tabular-nums text-transparent select-none"
                              aria-hidden
                            >
                              in
                            </span>
                          </div>
                        </div>

                        {/* Width */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground/45">Width</Label>
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                "flex min-h-10 min-w-0 max-w-[11rem] flex-1 items-center justify-center rounded-md border border-input bg-background px-1.5 shadow-sm ring-offset-background",
                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                                formData.boardSkipOptionalDimensions && "opacity-60",
                              )}
                            >
                              <Input
                                ref={boardDimWidthRef}
                                type="text"
                                inputMode="text"
                                placeholder="19 1/4"
                                value={formData.boardWidthInches}
                                disabled={formData.boardSkipOptionalDimensions}
                                onChange={(e) => {
                                  const next = normalizeTapeStyleInchesInput(e.target.value)
                                  prevBoardWidthRef.current = next
                                  setFormData((fd) => ({ ...fd, boardWidthInches: next }))
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-base shadow-none tabular-nums placeholder:text-muted-foreground/45 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Board width in inches"
                              />
                            </div>
                            <span className="inline-flex w-5 shrink-0 items-center justify-center text-xs text-muted-foreground/45 tabular-nums">
                              in
                            </span>
                          </div>
                        </div>

                        {/* Thickness */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground/45">Thickness</Label>
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                "flex min-h-10 min-w-0 max-w-[11rem] flex-1 items-center justify-center rounded-md border border-input bg-background px-1.5 shadow-sm ring-offset-background",
                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                                formData.boardSkipOptionalDimensions && "opacity-60",
                              )}
                            >
                              <Input
                                ref={boardDimThicknessRef}
                                type="text"
                                inputMode="text"
                                placeholder="2 3/8"
                                value={formData.boardThicknessInches}
                                disabled={formData.boardSkipOptionalDimensions}
                                onChange={(e) => {
                                  const next = normalizeTapeStyleInchesInput(e.target.value)
                                  prevBoardThicknessRef.current = next
                                  setFormData((fd) => ({ ...fd, boardThicknessInches: next }))
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-base shadow-none tabular-nums placeholder:text-muted-foreground/45 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Board thickness in inches"
                              />
                            </div>
                            <span className="inline-flex w-5 shrink-0 items-center justify-center text-xs text-muted-foreground/45 tabular-nums">
                              in
                            </span>
                          </div>
                        </div>

                        {/* Volume */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground/45">Volume</Label>
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                "flex min-h-10 min-w-0 max-w-[11rem] flex-1 items-center justify-center rounded-md border border-input bg-background px-1.5 shadow-sm ring-offset-background",
                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                                formData.boardSkipOptionalDimensions && "opacity-60",
                              )}
                            >
                              <Input
                                ref={boardDimVolumeRef}
                                type="text"
                                inputMode="text"
                                placeholder="30.4"
                                value={formData.boardVolumeL}
                                disabled={formData.boardSkipOptionalDimensions}
                                onChange={(e) =>
                                  setFormData((fd) => ({
                                    ...fd,
                                    boardVolumeL: normalizeVolumeLitersInput(e.target.value),
                                  }))
                                }
                                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-base shadow-none tabular-nums placeholder:text-muted-foreground/45 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Board volume in liters"
                              />
                            </div>
                            <span className="inline-flex w-5 shrink-0 items-center justify-center text-xs text-muted-foreground/45 tabular-nums">
                              L
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-0.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 shrink-0 gap-0.5 whitespace-nowrap px-1.5 text-[10px] font-normal text-muted-foreground/45 hover:text-foreground"
                              aria-label={
                                formData.boardSkipOptionalDimensions
                                  ? "Open optional dimensions: add width, thickness, or liters"
                                  : "Open optional dimensions: why they matter and skip if needed"
                              }
                            >
                              <span>Optional</span>
                              <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-75" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            sideOffset={6}
                            className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden p-0"
                          >
                            <div className="border-b border-border bg-muted/30 px-3.5 py-3.5">
                              <p className="text-sm leading-relaxed text-muted-foreground/45">
                                Listings with length, width, thickness, and volume filled in tend to
                                sell better—buyers know exactly what they&apos;re comparing.
                              </p>
                              {formData.boardSkipOptionalDimensions ? (
                                <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                                  You&apos;re listing without width, thickness, or liters. Add them
                                  anytime before you publish.
                                </p>
                              ) : null}
                            </div>
                            <div className="p-1.5">
                              {formData.boardSkipOptionalDimensions ? (
                                <DropdownMenuItem
                                  className="py-2.5 text-sm"
                                  onSelect={() => {
                                    setFormData((fd) => ({
                                      ...fd,
                                      boardSkipOptionalDimensions: false,
                                    }))
                                  }}
                                >
                                  Add width, thickness & liters
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="py-2.5 text-sm"
                                  onSelect={() => {
                                    prevBoardWidthRef.current = ""
                                    prevBoardThicknessRef.current = ""
                                    setFormData((fd) => ({
                                      ...fd,
                                      boardSkipOptionalDimensions: true,
                                      boardWidthInches: "",
                                      boardThicknessInches: "",
                                      boardVolumeL: "",
                                    }))
                                  }}
                                >
                                  Don&apos;t have width, thickness, or liters
                                </DropdownMenuItem>
                              )}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                      </div>

                    <Separator className="bg-border" />

                    <div className="space-y-6">
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
                      placeholder="Describe your board…"
                      className="min-h-[120px] resize-none placeholder:text-muted-foreground/45"
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
                    <span className="text-xs text-muted-foreground/45">
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
                                title: formData.title.trim(),
                                brand: formData.brand || "",
                                model:
                                  formData.boardModelName.trim() ||
                                  formData.boardIndexLabel ||
                                  "",
                                category: boardCategoryOptions.find((c) => c.value === formData.category)?.label || "",
                                boardType: formData.boardType,
                                condition: formData.condition,
                                length: boardLengthFormatted,
                                width: formData.boardWidthInches,
                                thickness: formData.boardThicknessInches,
                                volume: formData.boardVolumeL,
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
                          <span className="text-xs text-muted-foreground/45">
                            Will replace your current description
                          </span>
                        )}
                      </div>

                      {/* Quick add chips */}
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground/45">Quick add:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "Board is in great shape",
                            "Only surfed a few times",
                            "Board surfs great, just looking to try something new",
                            "Board was a little small for me",
                            "Board was a little too big for me",
                            "No dings",
                            "Dings professionally repaired",
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
                    </div>

                    </div>
                </SellFormSection>

                <SellFormSection
                  sectionId="sell-section-delivery"
                  title="Pickup & shipping"
                  description="Pin where the board is and choose delivery options."
                >
                  <div className="space-y-8">
                    <div className="space-y-6">
                      <LocationPicker
                        prefillSuggested={listingLocationPrefillHint}
                        onLocationSelect={(loc) => {
                          setPickupShippingLocationUserCommits((c) => c + 1)
                          setListingLocationPrefillHint(null)
                          setFormData((f) => ({
                            ...f,
                            locationLat: loc.lat,
                            locationLng: loc.lng,
                            locationCity: loc.city,
                            locationState: loc.state,
                            locationDisplay: loc.displayName,
                          }))
                        }}
                        onLocationClear={() => {
                          setPickupShippingLocationUserCommits(0)
                          setListingLocationPrefillHint(null)
                          setFormData((f) => ({
                            ...f,
                            locationLat: 0,
                            locationLng: 0,
                            locationCity: "",
                            locationState: "",
                            locationDisplay: "",
                          }))
                          window.setTimeout(() => {
                            void applySellLocationPrefillIfEmpty()
                          }, 0)
                        }}
                        initialLat={formData.locationLat || undefined}
                        initialLng={formData.locationLng || undefined}
                        initialCity={formData.locationCity}
                        initialState={formData.locationState}
                        initialDisplay={formData.locationDisplay}
                      />

                      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            Delivery options{" "}
                            <span className="text-destructive" aria-hidden="true">
                              *
                            </span>
                          </h3>
                          <p className="text-sm text-muted-foreground/45 mt-1">
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
                                  ...(want
                                    ? {}
                                    : {
                                        boardShippingCostMode: "reswell" as BoardShippingCostMode,
                                        boardShippingPrice: "",
                                        reswellPackageLengthIn: "",
                                        reswellPackageWidthIn: "",
                                        reswellPackageHeightIn: "",
                                        reswellPackageWeightLb: "",
                                        reswellPackageWeightOz: "",
                                      }),
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
                                  className="border-0 bg-[#3b63e3] text-white font-bold uppercase tracking-wide text-[10px] px-2 py-0.5 h-auto"
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
                            onValueChange={(value) => {
                              const mode = value as BoardShippingCostMode
                              if (mode === "reswell") {
                                reswellWeightManualRef.current = false
                              }
                              setFormData({
                                ...formData,
                                boardShippingCostMode: mode,
                              })
                            }}
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
                              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium leading-snug text-foreground">
                                    Let Reswell determine the shipping cost for you
                                  </span>
                                  <Badge
                                    variant="default"
                                    className="border-0 bg-[#3b63e3] text-white font-bold uppercase tracking-wide text-[10px] px-2 py-0.5 h-auto shrink-0"
                                  >
                                    Recommended
                                  </Badge>
                                </div>
                                {formData.boardShippingCostMode === "reswell" ? (
                                  <p className="text-sm text-muted-foreground/45 leading-relaxed">
                                    We&apos;ll calculate shipping from your packed dimensions and add
                                    it to the buyer&apos;s total at checkout. When an order is
                                    placed, we&apos;ll email you the shipping label.{" "}
                                    <Link
                                      href="/terms"
                                      className="text-foreground underline underline-offset-2 hover:text-primary"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View terms
                                    </Link>
                                  </p>
                                ) : null}
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
                              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                                <span className="text-sm font-medium leading-snug text-foreground">
                                  Offer free shipping
                                </span>
                                {formData.boardShippingCostMode === "free" ? (
                                  <p className="text-sm text-muted-foreground/45 leading-relaxed">
                                    Attract more buyers by offering to cover shipping! You can adjust
                                    the listing&apos;s price to make up for the cost.
                                  </p>
                                ) : null}
                              </div>
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
                              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                                <span className="text-sm font-medium leading-snug text-foreground">
                                  Set a flat shipping rate
                                </span>
                                {formData.boardShippingCostMode === "flat" ? (
                                  <p className="text-sm text-muted-foreground/45 leading-relaxed">
                                    Determine one cost that all buyers in this entire region will pay.
                                  </p>
                                ) : null}
                              </div>
                            </label>
                          </RadioGroup>
                          {formData.boardShippingCostMode === "flat" ? (
                            <div className="rounded-lg border border-border bg-background p-4 sm:p-5 space-y-4">
                              <h4 className="text-sm font-semibold text-foreground">
                                Set a shipping rate for the Continental U.S.{" "}
                                <span className="text-destructive" aria-hidden="true">
                                  *
                                </span>
                              </h4>
                              <div className="space-y-2 max-w-md">
                                <Label
                                  htmlFor="boardShippingPrice"
                                  className="text-sm font-semibold text-foreground"
                                >
                                  Shipping Rate{" "}
                                  <span className="text-destructive" aria-hidden="true">
                                    *
                                  </span>
                                </Label>
                                <div className="relative">
                                  <span
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground/45"
                                    aria-hidden
                                  >
                                    $
                                  </span>
                                  <Input
                                    id="boardShippingPrice"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.boardShippingPrice}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        boardShippingPrice: e.target.value,
                                      })
                                    }
                                    className="pl-8 tabular-nums placeholder:text-muted-foreground/45"
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
                                  onClick={() => setShippingEstimatorOpen(true)}
                                >
                                  Shipping label cost estimator
                                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                          ) : null}

                    </div>
                  </div>
                </SellFormSection>

                {deliveryFlags.shipping_available &&
                formData.boardShippingCostMode === "reswell" ? (
                  <SellFormSection
                    sectionId="sell-section-reswell-package"
                    title="Reswell shipping: packed size & weight"
                  >
                    <ReswellPackageDimensionsCard
                      showHeading={false}
                      className="border-0 bg-transparent p-0 shadow-none rounded-none"
                      lengthIn={formData.reswellPackageLengthIn}
                      widthIn={formData.reswellPackageWidthIn}
                      heightIn={formData.reswellPackageHeightIn}
                      weightLb={formData.reswellPackageWeightLb}
                      weightOz={formData.reswellPackageWeightOz}
                      onLengthInChange={(v) =>
                        setFormData({
                          ...formData,
                          reswellPackageLengthIn: normalizeBoardLengthInput(v),
                        })
                      }
                      onWidthInChange={(v) =>
                        setFormData({
                          ...formData,
                          reswellPackageWidthIn: normalizeTapeStyleInchesInput(v),
                        })
                      }
                      onHeightInChange={(v) =>
                        setFormData({
                          ...formData,
                          reswellPackageHeightIn: normalizeTapeStyleInchesInput(v),
                        })
                      }
                      onWeightLbChange={(v) => {
                        reswellWeightManualRef.current = true
                        setFormData({ ...formData, reswellPackageWeightLb: v })
                      }}
                      onWeightOzChange={(v) => {
                        reswellWeightManualRef.current = true
                        setFormData({ ...formData, reswellPackageWeightOz: v })
                      }}
                    />
                  </SellFormSection>
                ) : null}

                <SellFormSection
                  sectionId="sell-section-publish"
                  title={
                    editId
                      ? listingIsDraft
                        ? "Price & publish your listing"
                        : "Price & save your listing"
                      : "Price & publish your listing"
                  }
                >
                <div className="space-y-6">
                  <SellPriceFields
                    listingPrice={formData.price}
                    onListingPriceChange={(value) =>
                      setFormData({ ...formData, price: value })
                    }
                    sellerPurchasePrice={formData.sellerPurchasePrice}
                    onSellerPurchasePriceChange={(value) =>
                      setFormData({ ...formData, sellerPurchasePrice: value })
                    }
                    afterListingPrice={
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
                            <p className="text-sm text-muted-foreground/45 leading-relaxed">
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
                              <p className="text-sm text-muted-foreground/45 leading-relaxed">
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
                                className="placeholder:text-muted-foreground/45"
                              />
                              <p className="text-xs text-muted-foreground/45 leading-relaxed">
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
                            <p className="text-sm text-muted-foreground/45 leading-relaxed">
                              Lets you negotiate a final price with buyers before checkout.
                            </p>
                          </div>
                        </div>
                      </div>
                    }
                  />
                  <Separator />
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
                        src={proxiedListingImageSrc(publishPreview.coverUrl) || "/placeholder.svg"}
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
                      <p className="text-sm text-muted-foreground/45">
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
                          <p className="text-xs text-muted-foreground/45">
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
                    <p className="text-xs text-muted-foreground/45">
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
                </div>
                </SellFormSection>
                </form>
              </div>
            </div>
              )}
        </div>
        <SurfboardShippingEstimatorDialog
          open={shippingEstimatorOpen}
          onOpenChange={setShippingEstimatorOpen}
          boardLength={formData.boardLength}
          boardWidthInches={formData.boardWidthInches}
          boardThicknessInches={formData.boardThicknessInches}
          boardVolumeL={formData.boardVolumeL}
          locationLat={formData.locationLat}
          locationLng={formData.locationLng}
        />
      </main>
  )
}

const SellPageContent = React.memo(SellPageContentInner)

export default function SellFlowShell(props: {
  initialSellListingAreaPrefill: SellListingAreaPrefillCityState
  initialSellDrafts: SellDraftItem[]
  /** From the incoming request URL (RSC); merged with live `useSearchParams` client-side */
  urlEditListingId: string | null
}) {
  return <SellSearchParamsBridge {...props} />
}

/** Reads URL params — avoids wrapping the shell in Suspense so stored locality prefill renders immediately */
function SellSearchParamsBridge(props: {
  initialSellListingAreaPrefill: SellListingAreaPrefillCityState
  initialSellDrafts: SellDraftItem[]
  urlEditListingId: string | null
}) {
  const searchParams = useSearchParams()
  const qEditRaw = searchParams.get("edit")
  const editId =
    typeof qEditRaw === "string" && qEditRaw.trim() !== ""
      ? qEditRaw.trim()
      : props.urlEditListingId

  /** Next serializes query on SSR + client transitions; avoids relying solely on Suspense spinner */
  const startFresh = searchParams.get("new") === "1"

  return (
    <SellPageContent
      editId={editId}
      startFresh={startFresh}
      initialSellListingAreaPrefill={props.initialSellListingAreaPrefill}
      initialSellDrafts={props.initialSellDrafts}
    />
  )
}
