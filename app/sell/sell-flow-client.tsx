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
import { createPortal } from "react-dom"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { purgeListingImageStorageAction } from "@/lib/actions/listingImageStoragePurge"
import { peerListingEditHref } from "@/lib/peer-listing-sections"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SmoothCollapse } from "@/components/ui/smooth-collapse"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import {
  Loader2,
  X,
  Check,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react"
import { LocationPicker, type LocationPrefillSuggested } from "@/components/location-picker"
import { listingDetailHref } from "@/lib/listing-href"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import { setJustPublishedListingMarker } from "@/lib/sell-flow/just-published"
import { navigateAfterListingSave } from "@/lib/sell-flow/navigate-after-listing-save"
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
  getActiveImpersonationClient,
  getImpersonation,
  IMPERSONATION_CHANGED_EVENT,
  type ImpersonationData,
} from "@/lib/impersonation"
import { ImpersonationActingAsStrip } from "@/components/impersonation-banner"
import { updateImpersonatedListingViaApi } from "@/lib/utils/admin-impersonated-listing-create"
import {
  adminIsEditingAnotherUsersListing,
  ensureImpersonationForListingOwner,
  syncClientImpersonationForListingOwner,
} from "@/lib/utils/admin-impersonation-for-listing"
import { isAdminListingEditEntry } from "@/lib/utils/admin-listing-edit-entry"
import type { IndexBoardModelSelection } from "@/components/index-board-model-combobox"
import { SurfboardTitleIndexInput } from "@/components/surfboard-title-index-input"
import {
  assertListingOriginalSize,
  prepareListingImagePairFromFile,
  type PreparedListingImagePair,
} from "@/lib/listing-image-pipeline"
import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import { uploadListingImagePairToSupabase } from "@/lib/listing-image-storage"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import {
  buildSellListingDraft,
  clearGuestSellListingDraft,
  clearSellListingDraft,
  loadGuestSellListingDraft,
  loadSellListingDraft,
  migrateGuestSellListingDraftToUser,
  saveGuestSellListingDraft,
  saveSellListingDraft,
  type SellListingDraftFormSnapshot,
} from "@/lib/sell-listing-draft-idb"
import { friendlyListingPhotoErrorMessage } from "@/lib/utils/friendly-listing-photo-error"
import {
  SELL_SUBMIT_INTERRUPTED_MESSAGE,
  isSellSubmitAbortError,
  retryOnceOnSellSubmitAbort,
  sellActionErrorMessage,
  sellSubmitErrorMessage,
} from "@/lib/sell-flow/sell-submit-error"
import { sellerPurchasePriceToDb } from "@/lib/utils/seller-purchase-price"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { applyBoardListingPublishedSideEffectsAction } from "@/lib/actions/boardListingPublishActions"
import { logSellFunnelEvent } from "@/lib/sell-flow/log-sell-funnel-event"
import { useSellFunnelStepTracking } from "@/lib/sell-flow/use-sell-funnel-step-tracking"
import { cn } from "@/lib/utils"
import {
  RequestBrandModelDialog,
  type ListingCatalogRequestVariant,
} from "@/components/request-brand-model-dialog"
import { SellFlowFormColumnSkeleton } from "@/components/features/sell/sell-flow-route-skeleton"
import { SellEditLoadError } from "@/components/features/sell/sell-edit-load-error"
import { SellListingPublishedScreen } from "@/components/features/sell/sell-listing-published-screen"
import { useOwnedListingEditLoad } from "@/components/features/sell/hooks/use-owned-listing-edit-load"
import {
  sellFormSnapshotLooksFilled,
  useSellServerDraft,
} from "@/components/features/sell/hooks/use-sell-server-draft"
import { clearSellServerDraftListingId, getSellServerDraftListingId, replaceSellDraftEditUrl, setSellServerDraftListingId } from "@/lib/sell-draft-local-meta"
import { AdminBulkListingBanner } from "@/components/features/sell/admin-bulk-listing-banner"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import { normalizeSellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import { SellBoardModelField } from "@/components/sell-board-model-field"
import { listingDetailPath } from "@/lib/listing-query"
import { revalidateListingDetailAfterListingMutation } from "@/app/actions/listing-detail-cache"
import { revalidateNavSearchSuggestAfterListingPublished } from "@/app/actions/nav-search-suggest-cache"
import { saveDefaultListingLocationAction } from "@/app/actions/sell-default-location"
import {
  readSellSavedListingLocations,
  rememberSellSavedListingLocation,
  type SellSavedListingLocation,
} from "@/lib/utils/sell-saved-listing-locations"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import { listingPhotoSlotsForDraftPersist } from "@/lib/sell-flow/listing-photo-slot"
import type { OwnedListingForEditRow } from "@/lib/db/listingEdit"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import {
  validateSellListingForm,
  buildResolvedListingTitle,
  LISTING_TITLE_MAX_LENGTH,
  type BoardShippingCostMode,
  type SellFormValidationInput,
} from "@/lib/sell-form-validation"
import {
  LISTING_CONDITION_SELL_OPTIONS,
  sellFormConditionValue,
} from "@/lib/listing-labels"
import {
  formatBoardLengthForTitle,
  isBoardLengthEntryComplete,
  isTapeStyleInchesEntryComplete,
  normalizeTapeStyleInchesInput,
} from "@/lib/board-measurements"
import {
  boardBrowseFacetFieldsForDb,
  finsIncludedFormValue,
  finsSetupFieldForDb,
} from "@/lib/listing-facet-write"
import { singleFinSetupSlugForForm } from "@/lib/listing-fin-setup-tags"
import {
  listingDimensionsColumnFromSurfboardSellForm,
  surfboardSellFormDimensionsFromListingRow,
} from "@/lib/listing-dimensions-storage"
import {
  parseSurfboardShippingTierId,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import {
  parseSurfboardShippingPackBandId,
  surfboardShippingPackBandFixedParcel,
  type SurfboardShippingPackBandId,
} from "@/lib/surfboard-shipping-pack-bands"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { SellBoardDimensionsPicker } from "@/components/features/sell/sell-board-dimensions-picker"
import { SellBoardStockSizePicker } from "@/components/features/sell/sell-board-stock-size-picker"
import { SellRequiredMark } from "@/components/features/sell/sell-required-mark"
import type { SurfboardStockSizeOption } from "@/lib/types/board-stock-sizes"
import {
  SellBoardFacetFields,
  SellFacetChipGroup,
} from "@/components/features/sell/sell-board-facet-fields"
import { SellPriceFields } from "@/components/features/sell/sell-price-fields"
import { resolveCompareAtPriceOnUpdate } from "@/lib/listing-compare-at-price"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { SellBoardModeHeader } from "@/components/features/sell/sell-board-mode-header"
import { SellListingPhotoGrid } from "@/components/features/sell/sell-listing-photo-grid"
import { sellListingThumbLoadedSrcByClientId } from "@/components/features/sell/hooks/use-listing-photo-upload"
import { useListingVideoUpload } from "@/components/features/sell/hooks/use-listing-video-upload"
import { createEmptyListingVideoSlot } from "@/lib/sell-flow/listing-video-slot"
import { syncListingDraftVideosClient } from "@/lib/sell-flow/sync-listing-draft-videos-client"
import {
  SELL_COMPLETE_BADGE_CLASS,
  SELL_CONTROL_CLASS,
  SELL_FORM_COLUMN_CLASS,
  SELL_PAGE_GROUND_CLASS,
  SELL_PRIMARY_BUTTON_CLASS,
  SELL_SECTION_CARD_CLASS,
  SELL_SECTION_DESCRIPTION_CLASS,
} from "@/components/features/sell/sell-form-surface"
import { SellPhotoExamplesBanner } from "@/components/features/sell/sell-photo-examples-banner"
import {
  SellSectionNav,
  SellSectionNavHorizontal,
  SELL_FORM_SECTION_NAV_ITEMS,
} from "@/components/features/sell/sell-section-nav"
import { SellSectionNavMobileProgress } from "@/components/features/sell/sell-section-nav-mobile-progress"
import { BoardSellViewToolbar } from "@/components/features/sell/board-sell-view-toolbar"
import {
  computeSellSectionCompletion,
  computeSellStepChecklist,
} from "@/lib/sell-section-completion"
import {
  boardCategoryMap,
  boardTypeFromCategoryId,
  resolveListingBoardTypeFromCategory,
} from "@/lib/utils/board-type-from-category-id"
import {
  orderSurfboardSellCategoryOptions,
  staticSellBoardCategoryOptions,
  type SellCategoryOptionRow,
} from "@/lib/surfboard-sell-categories"
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"
import { upsertUserListingBoardModelDataFromSellForm } from "@/lib/db/user-listing-board-model-data"
import {
  SELL_SUPPRESS_IDB_RESTORE_KEY,
  isPendingPublish,
  sellPendingPublishKey,
} from "@/lib/sell-flow/session-keys"
import { beginGuestListingPublishAuth } from "@/lib/sell-flow/guest-publish-auth"
import { usePendingPublishResume } from "@/components/features/sell/hooks/use-pending-publish-resume"
import {
  clearSellCatalogSearchAgain,
  markSellCatalogSearchAgain,
  peekSellCatalogHandoff,
  sellListingCameFromCatalogSearch,
  takeSellCatalogHandoff,
} from "@/lib/sell-flow/catalog-handoff"
import {
  SellCatalogSelectionCard,
  type SellCatalogSelectionCardData,
} from "@/components/features/sell/sell-catalog-selection-card"
import { sellCatalogSearchCategoryLabel } from "@/lib/types/sell-catalog-search"
import {
  BOARD_SELL_SECTION_ID_BY_STEP,
  BOARD_SELL_STEP_BY_SECTION_ID,
  clearPersistedBoardSellFlowStep,
  nextBoardSellFlowStep,
  parseBoardSellFlowStep,
  persistBoardSellFlowStep,
  prevBoardSellFlowStep,
  readStoredBoardSellFlowStep,
  type BoardSellFlowStep,
} from "@/lib/sell-flow/board-sell-flow-step"
import {
  persistBoardSellViewMode,
  readStoredBoardSellViewMode,
  type BoardSellViewMode,
} from "@/lib/sell-flow/board-sell-view-mode"

/** True once the seller has pinned the board (coordinates used for drafts + validation). */
function sellFormHasCommittedMapPins(fd: { locationLat: number; locationLng: number }): boolean {
  const lat = fd.locationLat
  const lng = fd.locationLng
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false
  return true
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
  complete,
}: {
  title: string
  children: React.ReactNode
  description?: string
  /** Anchor id for in-page navigation (sell section stepper). */
  sectionId?: string
  complete?: boolean
}) {
  return (
    <section
      id={sectionId}
      className={cn(
        "w-full space-y-4 sm:space-y-6",
        sectionId && "scroll-mt-28",
      )}
    >
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:text-[1.85rem] lg:text-3xl">
            {title}
          </h2>
          {description ? (
            <p
              className={cn(
                SELL_SECTION_DESCRIPTION_CLASS,
                "text-[15px] sm:text-base lg:text-[17px]",
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {complete ? (
          <span className={cn("mt-1.5 hidden shrink-0 sm:inline-flex", SELL_COMPLETE_BADGE_CLASS)}>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Done
          </span>
        ) : null}
      </div>
      <Card className={SELL_SECTION_CARD_CLASS}>
        <CardContent className="p-5 sm:p-9 lg:p-11">{children}</CardContent>
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
  listingId?: string | null
  slug?: string | null
  condition: string
  boardType: string
  shippingAvailable: boolean
  localPickup: boolean
  listingImages: ListingImageForCard[]
  errorMessage?: string
  failedStepLabel?: string
}

function SellPublishingGenericLoaderPortal() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = prev
    }
  }, [mounted])

  if (!mounted || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Working"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background p-8 animate-in fade-in motion-reduce:animate-none duration-300"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-xl border border-border bg-card p-8 shadow-md">
        <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>,
    document.body,
  )
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
  /** True = apply 180° after automatic landscape→portrait step (toggle). */
  userRotate180?: boolean
  /**
   * After upload, drop `sourceFile` so the next rotation re-downloads from `url`.
   * Server-hydrated rows and temporary fetches for editing use this; user-picked files do not.
   */
  dropSourceFileAfterUpload?: boolean
  /** Bumps when re-processing the same slot so stale async work does not apply. */
  prepareSeq?: number
}

function listingImagesForPublishPreview(images: ListingPhotoSlot[]): ListingImageForCard[] {
  return images
    .filter((im) => Boolean(im.url || im.thumbnailUrl || im.previewUrl))
    .map((im, index) => ({
      url: im.url || im.previewUrl || null,
      thumbnail_url: im.thumbnailUrl || im.previewUrl || null,
      is_primary: index === 0,
    }))
}

const LISTING_PHOTO_FILE_EXT_RE = /\.(heic|heif|jpe?g|png|webp|gif|avif|tif?f)$/i

function isListingPhotoFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (mime.startsWith("image/")) return true
  return LISTING_PHOTO_FILE_EXT_RE.test(file.name)
}

function filesFromDataTransfer(dt: DataTransfer): File[] {
  const fromList = Array.from(dt.files ?? []).filter(isListingPhotoFile)
  if (fromList.length) return fromList
  const out: File[] = []
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue
    const file = item.getAsFile()
    if (file && isListingPhotoFile(file)) out.push(file)
  }
  return out
}

function isOsFileDragEvent(e: React.DragEvent): boolean {
  const types = Array.from(e.dataTransfer.types ?? [])
  return (
    types.includes("Files") ||
    types.includes("public.file-url") ||
    types.includes("application/x-moz-file")
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
  const { boardFlowStep: _boardFlowStep, ...snapshotFields } = snapshot
  const base = {
    ...createInitialSellFormData(),
    ...snapshotFields,
  } as ReturnType<typeof createInitialSellFormData>
  return {
    ...base,
    // Surfboard /sell is Reswell shipping only — coerce legacy free/flat drafts.
    boardShippingCostMode: "reswell" as BoardShippingCostMode,
    // Always seller-entered package size (no pack-band autofill).
    adminCustomShippingCarton: true,
    surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
    surfboardShippingPackBandCeilingConfirmed: false,
    boardFins: singleFinSetupSlugForForm(snapshot.boardFins),
    boardFinSystem:
      typeof snapshot.boardFinSystem === "string" ? snapshot.boardFinSystem : base.boardFinSystem,
    boardConstruction:
      typeof snapshot.boardConstruction === "string"
        ? snapshot.boardConstruction
        : base.boardConstruction,
    boardFinsIncluded:
      typeof snapshot.boardFinsIncluded === "string"
        ? snapshot.boardFinsIncluded
        : base.boardFinsIncluded,
  }
}

function listingPhotoSlotsFromDraftBlobs(
  blobs: { name: string; type: string; buffer: ArrayBuffer }[],
): ListingPhotoSlot[] {
  const slots: ListingPhotoSlot[] = []
  for (const b of blobs) {
    try {
      const file = new File([b.buffer], b.name || "photo.jpg", {
        type: b.type || "image/jpeg",
      })
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
  return slots
}

async function persistSellListingDraftSnapshot(args: {
  listingType: "board"
  formData: SellListingDraftFormSnapshot
  images: ListingPhotoSlot[]
  userId: string | null
  includeInFlightPhotos?: boolean
}): Promise<void> {
  try {
    const built = await buildSellListingDraft(
      args.listingType,
      args.formData,
      listingPhotoSlotsForDraftPersist(args.images, {
        includeInFlight: args.includeInFlightPhotos,
      }),
      null,
      args.userId,
      { allowGuest: !args.userId },
    )
    if (built) {
      if (args.userId) await saveSellListingDraft(built)
      else await saveGuestSellListingDraft(built)
      return
    }
    if (args.userId) await clearSellListingDraft(args.userId)
    else await clearGuestSellListingDraft()
  } catch (e) {
    console.warn("[sell draft] persist failed", e)
  }
}

/** Mirrors the flat-rate rule in `deliverySectionComplete` (sell-section-completion). */
function flatShippingRateComplete(raw: string): boolean {
  const t = raw.trim().replace(/,/g, "")
  if (!t) return false
  const n = Number.parseFloat(t)
  return Number.isFinite(n) && n >= 0
}

/** Mirrors the auto-drop floor rule in `pricePublishFieldsComplete` (sell-section-completion). */
function priceDropFloorComplete(floorRaw: string, priceRaw: string): boolean {
  const floor = Number.parseFloat(floorRaw.trim().replace(/,/g, ""))
  if (!Number.isFinite(floor) || floor < 0.01 || floor > 999_999.99) return false
  const price = Number.parseFloat(priceRaw.trim().replace(/,/g, ""))
  return Number.isFinite(price) ? floor < price : true
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
    boardFulfillment: "pickup_and_shipping" as BoardFulfillmentChoice,
    boardShippingCostMode: "reswell" as BoardShippingCostMode,
    boardShippingPrice: "",
    surfboardShippingTier: "" as SurfboardShippingTierId | "",
    surfboardShippingTierCeilingConfirmed: false,
    surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
    surfboardShippingPackBandCeilingConfirmed: false,
    /** Board `/sell` Reswell shipping always uses seller-entered carton dims. */
    adminCustomShippingCarton: true,
    reswellPackageLengthIn: "",
    reswellPackageWidthIn: "",
    reswellPackageHeightIn: "",
    reswellPackageWeightLb: "",
    reswellPackageWeightOz: "",
            autoPriceDrop: false,
    autoPriceDropFloor: "",
    showPriceMarkdown: false,
    loadedPublishedPriceUsd: null as number | null,
    loadedCompareAtPriceUsd: null as number | null,
    buyerOffers: true,
    boardType: "",
    boardLength: "",
    boardWidthInches: "",
    boardThicknessInches: "",
    boardVolumeL: "",
    boardFins: "",
    boardTail: "",
    boardFinSystem: "",
    boardConstruction: "",
    boardFinsIncluded: "",
    boardBrandId: "",
    boardBrandModelId: "",
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

function listingSurfboardBrandFieldsForDb(
  fd: ReturnType<typeof createInitialSellFormData>,
): { brand_model_id: string | null; model: string | null } {
  const catalogId = fd.boardBrandModelId.trim()
  const modelText = fd.boardModelName.trim()
  return {
    brand_model_id: catalogId || null,
    model: modelText || null,
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

/** Set when a guest taps Publish — resume submit after sign-in (survives full-page login redirect). */
const SELL_PENDING_PUBLISH_KEY = sellPendingPublishKey("board")

type SellPageContentProps = {
  editId: string | null
  startFresh: boolean
  /** Soft draft open — updates local edit id + URL without an App Router navigation. */
  onSoftOpenDraft?: (draftId: string) => void
  /** Server-resolved `profiles.is_admin` so privileged shipping cards paint immediately. */
  initialActorIsAdmin?: boolean
}

function SellPageContentInner({
  editId,
  startFresh,
  onSoftOpenDraft,
  initialActorIsAdmin,
}: SellPageContentProps) {
  const listingPhotosInputId = useId()
  const listingVideoInputId = useId()
  const router = useRouter()
  const sellSearchParams = useSearchParams()
  const bulkSlotId = sellSearchParams.get("bulk")?.trim() || null
  const wantsBlankListing = startFresh || sellSearchParams.get("new") === "1"
  const openSignIn = useSignInGate()
  const supabase = useMemo(() => createClient(), [])
  const boardSellReturnPath = useCallback(
    () =>
      typeof window === "undefined"
        ? "/sell/boards"
        : `${window.location.pathname}${window.location.search}`,
    [],
  )

  /**
   * “Search again” only after a /sell catalog pick. Capture `from=catalog`
   * before `?new=1` is stripped so type-chooser / direct `/sell/boards` stays hidden.
   */
  const [cameFromCatalogSearch, setCameFromCatalogSearch] = useState(() =>
    sellListingCameFromCatalogSearch(startFresh),
  )

  /** Strip `?new=1` from the URL after blank-listing setup; stay on `/sell/boards`. */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    if (startFresh) {
      const fromCatalog =
        new URLSearchParams(window.location.search).get("from") === "catalog"
      if (fromCatalog) {
        markSellCatalogSearchAgain()
        setCameFromCatalogSearch(true)
      } else {
        clearSellCatalogSearchAgain()
        setCameFromCatalogSearch(false)
      }
      if (!isPendingPublish("board")) {
        try {
          sessionStorage.setItem(SELL_SUPPRESS_IDB_RESTORE_KEY, "1")
        } catch {
          /* quota / private mode */
        }
      }
      router.replace("/sell/boards", { scroll: false })
    }
  }, [startFresh, router])

  const [impersonation, setImpersonation] = useState<ImpersonationData | null>(null)
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  const [actorIsAdmin, setActorIsAdmin] = useState<boolean | null>(
    typeof initialActorIsAdmin === "boolean" ? initialActorIsAdmin : null,
  )
  useEffect(() => {
    clearImpersonationStorageIfCookieMissing()
    const sync = () => setImpersonation(getActiveImpersonationClient())
    sync()
    window.addEventListener(IMPERSONATION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(IMPERSONATION_CHANGED_EVENT, sync)
  }, [])

  const [loading, setLoading] = useState(false)
  const [publishValidationBanner, setPublishValidationBanner] = useState<string | null>(null)
  const [, setSubmitStepIndex] = useState(0)
  const submitStepIndexRef = useRef(0)
  const [publishPreview, setPublishPreview] = useState<PublishPreviewState | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  /** Prevents concurrent publishes (double-tap / stacked submits before `loading` flips). */
  const publishInFlightRef = useRef(false)
  /** Skip Chrome's native leave-site prompt on intentional post-publish navigation. */
  const allowDocumentUnloadRef = useRef(false)
  const uploadToastIdRef = useRef<string | number | null>(null)
  const uploadPhaseLabelsRef = useRef<string[]>([...LISTING_UPLOAD_STEP_LABELS])
  const [, setUploadPhaseLabels] = useState<string[]>(() => [
    ...LISTING_UPLOAD_STEP_LABELS,
  ])
  const [draftHydrated, setDraftHydrated] = useState(!!editId)
  /** Stable SSR defaults — sessionStorage restored after mount to avoid hydration mismatch. */
  const [flowStep, setFlowStep] = useState<BoardSellFlowStep>("product")
  const setBoardFlowStep = useCallback((step: BoardSellFlowStep) => {
    setFlowStep(step)
    persistBoardSellFlowStep(step)
  }, [])
  const [viewMode, setViewModeState] = useState<BoardSellViewMode>("guided")
  const setViewMode = useCallback((mode: BoardSellViewMode) => {
    setViewModeState(mode)
    persistBoardSellViewMode(mode)
  }, [])
  const [editListingStatus, setEditListingStatus] = useState<string | null>(null)
  const [signedInUserId, setSignedInUserId] = useState<string | null>(null)
  /** Guests exit to browse; signed-in sellers to their listings hub (`/listings` → dashboard). */
  const sellListingsHubHref = "/sell"
  const listingIsDraft = editListingStatus === "draft"
  /**
   * Published (or non-draft) listing edit: stepper may reflect saved data without forcing
   * “scroll + confirm location” — that rule applies to new listings and drafts only.
   */
  const skipPickupShippingStepperInteractionUx = Boolean(
    editId && typeof editListingStatus === "string" && editListingStatus !== "draft",
  )
  /**
   * Stepper UX: require seeing the delivery section, then an explicit location pick in-session
   * (LocationPicker fires onLocationSelect).
   * Hydrated drafts / restores already carry map pins — those count as confirmed for the rail/publish UX.
   */
  const [pickupShippingSectionEnteredOnce, setPickupShippingSectionEnteredOnce] = useState(false)
  const [pickupShippingLocationUserCommits, setPickupShippingLocationUserCommits] = useState(0)
  const sellDraftUserIdRef = useRef<string | null>(null)
  const editIdRef = useRef<string | null>(editId)
  const [startNewListingBusy, setStartNewListingBusy] = useState(false)

  useEffect(() => {
    editIdRef.current = editId
  }, [editId])

  useEffect(() => {
    setPickupShippingSectionEnteredOnce(false)
    setPickupShippingLocationUserCommits(0)
  }, [editId])

  /** Server / soft draft opens start on the first wizard step. */
  useEffect(() => {
    if (!editId) return
    setFlowStep("product")
    persistBoardSellFlowStep("product")
  }, [editId])

  /** Restore guided/advanced + step from session after mount (must not run during SSR). */
  useEffect(() => {
    if (editId) return
    // New listings and catalog handoffs always open Guided from the first step.
    if (startFresh || peekSellCatalogHandoff("surfboards")) {
      setFlowStep("product")
      persistBoardSellFlowStep("product")
      setViewModeState("guided")
      persistBoardSellViewMode("guided")
      return
    }
    const storedStep = readStoredBoardSellFlowStep()
    if (storedStep) setFlowStep(storedStep)
    const storedMode = readStoredBoardSellViewMode()
    if (storedMode) setViewModeState(storedMode)
  }, [editId, startFresh])

  useEffect(() => {
    if (!loading) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowDocumentUnloadRef.current) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [loading])
  const [images, setImages] = useState<ListingPhotoSlot[]>([])
  const [photosFileDragActive, setPhotosFileDragActive] = useState(false)
  const photosFileDragDepthRef = useRef(0)
  const imagesRef = useRef<ListingPhotoSlot[]>([])
  /** Authoritative prepare generation per slot — `imagesRef` can lag behind `setState` during re-runs. */
  const latestListingPhotoPrepareSeqRef = useRef<Map<string, number>>(new Map())
  useEffect(() => {
    imagesRef.current = images
  }, [images])
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])
  const removedImageIdsRef = useRef<string[]>([])
  useEffect(() => {
    removedImageIdsRef.current = removedImageIds
  }, [removedImageIds])

  const videoUpload = useListingVideoUpload({
    signInReturnPath: boardSellReturnPath,
    openSignIn,
    supabase,
    promptSignInOnUpload: false,
  })
  const {
    video,
    setVideo,
    removedVideoIds,
    setRemovedVideoIds,
    videoUploadReady,
    videoUploading,
    readyVideo,
    handleVideoInputChange,
    handleVideoRemove,
    handleVideoRetry,
    hydrateExistingVideo,
  } = videoUpload

  const [listingCatalogRequestVariant, setListingCatalogRequestVariant] =
    useState<ListingCatalogRequestVariant | null>(null)
  const [formData, setFormData] = useState(createInitialSellFormData)
  const formDataRef = useRef(formData)
  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

  // One-shot brand/model prefill from the /sell cross-category catalog search wall.
  // Applied only after draft hydration: the IDB draft restore replaces the whole
  // form state async, so applying earlier would let a stale draft clobber the
  // catalog selection the seller just made.
  const catalogHandoffTakenRef = useRef(false)
  const [catalogSelectionCard, setCatalogSelectionCard] = useState<
    (SellCatalogSelectionCardData & { brandId: string }) | null
  >(null)
  useEffect(() => {
    if (!draftHydrated || catalogHandoffTakenRef.current || editId) return
    catalogHandoffTakenRef.current = true
    const handoff = takeSellCatalogHandoff("surfboards")
    if (!handoff) return
    markSellCatalogSearchAgain()
    setCameFromCatalogSearch(true)
    setViewModeState("guided")
    persistBoardSellViewMode("guided")
    if (handoff.selectionKind !== "variant") {
      setCatalogSelectionCard({
        brandId: handoff.brandId,
        brandName: handoff.brandName,
        modelName: handoff.selectionKind === "model" ? handoff.modelName : null,
        categoryLabel: sellCatalogSearchCategoryLabel(handoff.category),
        imageUrl: handoff.imageUrl,
        imageIsLogo: handoff.imageIsLogo,
      })
    }
    if (handoff.selectionKind === "brand") {
      setFormData((f) => ({
        ...f,
        title: f.title.trim() ? f.title : handoff.suggestedTitle,
        description:
          f.description.trim() || !handoff.suggestedDescription
            ? f.description
            : handoff.suggestedDescription,
        brand: handoff.brandName,
        boardLinkedBrandName: handoff.brandName,
        boardBrandId: handoff.brandId,
        boardIndexBrandSlug: handoff.brandSlug,
      }))
      return
    }
    if (handoff.selectionKind === "model") {
      // Catalog models tagged with a board shape auto-select the matching
      // "Board shape / category" chip (chip values are the fixed category UUIDs).
      // Do not prefill listing description from the catalog model write-up —
      // sellers write that themselves.
      const handoffBoardCategoryId = handoff.boardCategorySlug
        ? boardCategoryMap[handoff.boardCategorySlug] ?? ""
        : ""
      setFormData((f) => ({
        ...f,
        title: f.title.trim() ? f.title : handoff.suggestedTitle,
        brand: handoff.brandName,
        boardLinkedBrandName: handoff.brandName,
        boardBrandId: handoff.brandId,
        boardIndexBrandSlug: handoff.brandSlug,
        boardModelName: handoff.modelName,
        boardBrandModelId: handoff.brandModelId,
        ...(handoffBoardCategoryId && !f.category.trim()
          ? {
              category: handoffBoardCategoryId,
              boardType: handoff.boardCategorySlug ?? f.boardType,
            }
          : {}),
      }))
    }
  }, [editId, draftHydrated])

  // Stock sizes for the linked catalog model: shown as a one-tap size wall in
  // "Dimensions & details". Selecting one writes the same boardLength /
  // boardWidthInches / boardThicknessInches / boardVolumeL fields the manual
  // picker uses — storage and publish are unchanged.
  const [modelStockSizes, setModelStockSizes] = useState<SurfboardStockSizeOption[]>([])
  const [stockSizeMode, setStockSizeMode] = useState<"stock" | "custom">("stock")
  const [selectedStockSizeId, setSelectedStockSizeId] = useState<string | null>(null)
  const stockSizesModelId = formData.boardBrandModelId.trim()
  useEffect(() => {
    if (!stockSizesModelId) {
      setModelStockSizes([])
      setSelectedStockSizeId(null)
      setStockSizeMode("stock")
      return
    }
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch(
          `/api/sell/board-model-stock-sizes?brand_model_id=${encodeURIComponent(stockSizesModelId)}`,
          { signal: controller.signal },
        )
        if (!res.ok) return
        const json = (await res.json().catch(() => null)) as {
          data?: { sizes?: SurfboardStockSizeOption[] }
        } | null
        const sizes = json?.data?.sizes ?? []
        setModelStockSizes(sizes)

        // Reconcile with dims already in the form (draft restore / edit mode):
        // matching dims select their stock card; non-matching dims mean the
        // seller already entered a custom size, so keep the manual picker.
        const fd = formDataRef.current
        const match = sizes.find(
          (s) =>
            s.values.boardLength === fd.boardLength.trim() &&
            s.values.boardWidthInches === fd.boardWidthInches.trim() &&
            s.values.boardThicknessInches === fd.boardThicknessInches.trim(),
        )
        if (match) {
          setSelectedStockSizeId(match.id)
          setStockSizeMode("stock")
        } else {
          setSelectedStockSizeId(null)
          const hasDims = [fd.boardLength, fd.boardWidthInches, fd.boardThicknessInches].some(
            (v) => v.trim().length > 0,
          )
          setStockSizeMode(hasDims ? "custom" : "stock")
        }
      } catch {
        /* aborted or offline — manual dimension picker still works */
      }
    })()
    return () => controller.abort()
  }, [stockSizesModelId])

  const handleSelectStockSize = useCallback((size: SurfboardStockSizeOption) => {
    setSelectedStockSizeId(size.id)
    setStockSizeMode("stock")
    setFormData((fd) => ({ ...fd, ...size.values }))
  }, [])

  const handleChooseCustomStockSize = useCallback(() => {
    setStockSizeMode("custom")
    setSelectedStockSizeId(null)
  }, [])

  const openListingCatalogRequestFromBrand = useCallback(() => {
    setListingCatalogRequestVariant("full")
  }, [])

  const openListingCatalogRequestFromModel = useCallback(() => {
    const bid = formData.boardBrandId.trim()
    setListingCatalogRequestVariant(
      bid ? { modelOnlyWithDirectoryBrandId: bid } : "full",
    )
  }, [formData.boardBrandId])

  const [sellCategoryOptions, setSellCategoryOptions] = useState<SellCategoryOptionRow[]>([])
  const [sellCategoriesLoaded, setSellCategoriesLoaded] = useState(false)

  const boardCategoryOptions = useMemo(() => {
    const ordered = orderSurfboardSellCategoryOptions(
      sellCategoryOptions.filter((c) => c.board === true),
    )
    if (ordered.length > 0) return ordered
    return orderSurfboardSellCategoryOptions(staticSellBoardCategoryOptions())
  }, [sellCategoryOptions])

  const listingType = "board" as const

  const sellDraftLatestRef = useRef({
    listingType: "board" as const,
    formData: {} as SellListingDraftFormSnapshot,
    images: [] as ListingPhotoSlot[],
    editId: null as string | null,
    draftHydrated: false,
  })
  const sellDraftPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Quiet autosave indicator so sellers know they can safely leave and come back. */
  const [draftAutosaveState, setDraftAutosaveState] = useState<
    "idle" | "saving" | "saved"
  >("idle")
  const draftImageSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftPhotosPendingRef = useRef<ListingPhotoSlot[] | null>(null)
  /** Slots from IndexedDB restore — optimized in useLayoutEffect after `optimizeAndUploadSlot` exists. */
  const idbRestoreOptimizeQueueRef = useRef<ListingPhotoSlot[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setSellCategoriesLoaded(false)
    void (async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, board, slug")
        .eq("board", true)
      if (cancelled) return
      if (error) {
        console.warn("[sell] categories fetch failed:", error.message)
        setSellCategoryOptions(staticSellBoardCategoryOptions())
        setSellCategoriesLoaded(true)
        return
      }
      const rows = (data ?? []).map((r) => ({
        value: r.id,
        label: r.name ?? "",
        board: true as const,
        slug: r.slug ?? null,
      }))
      setSellCategoryOptions(
        rows.length > 0 ? rows : staticSellBoardCategoryOptions(),
      )
      setSellCategoriesLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  sellDraftLatestRef.current = {
    listingType,
    formData: { ...formData, boardFlowStep: flowStep } as SellListingDraftFormSnapshot,
    images,
    editId,
    draftHydrated,
  }

  const handleStartNewListing = useCallback(async () => {
    setStartNewListingBusy(true)
    try {
      for (const im of imagesRef.current) {
        if (im.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(im.previewUrl)
      }
      draftPhotosPendingRef.current = null
      setFormData(createInitialSellFormData())
      setBoardFlowStep("product")
      setViewModeState("guided")
      persistBoardSellViewMode("guided")
      clearPersistedBoardSellFlowStep()
      sellListingThumbLoadedSrcByClientId.clear()
      latestListingPhotoPrepareSeqRef.current.clear()
      setImages([])
      setRemovedImageIds([])
      setPublishPreview(null)
      clearSellServerDraftListingId("surfboards")
      clearSellCatalogSearchAgain()
      setCameFromCatalogSearch(false)
      setCatalogSelectionCard(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) await clearSellListingDraft(user.id)
      await clearGuestSellListingDraft()
      toast.message("Starting a new listing — saved drafts stay in your dashboard.")
      if (editId) {
        router.replace("/sell/boards?new=1", { scroll: false })
      }
    } finally {
      setStartNewListingBusy(false)
    }
  }, [editId, router, setBoardFlowStep, supabase])

  const buildBoardDraftPayload = useCallback(
    (listingId: string | null) => ({
      section: "surfboards" as const,
      listingId,
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
      surfboardShippingTier: formData.surfboardShippingTier,
      surfboardShippingTierCeilingConfirmed: formData.surfboardShippingTierCeilingConfirmed,
      surfboardShippingPackBand: formData.surfboardShippingPackBand,
      surfboardShippingPackBandCeilingConfirmed: formData.surfboardShippingPackBandCeilingConfirmed,
      adminCustomShippingCarton: formData.adminCustomShippingCarton,
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
      boardFins: formData.boardFins,
      boardTail: formData.boardTail,
      boardFinSystem: formData.boardFinSystem,
      boardConstruction: formData.boardConstruction,
      boardFinsIncluded: formData.boardFinsIncluded,
      boardBrandId: formData.boardBrandId,
      boardBrandModelId: formData.boardBrandModelId,
      boardModelName: formData.boardModelName,
      locationLat: formData.locationLat,
      locationLng: formData.locationLng,
      locationCity: formData.locationCity,
      locationState: formData.locationState,
    }),
    [formData],
  )

  const loadListingId = useMemo(
    () =>
      editId ??
      (wantsBlankListing ? null : getSellServerDraftListingId("surfboards")),
    [editId, wantsBlankListing],
  )

  const hydrateBoardEdit = useCallback(
    async (listing: OwnedListingForEditRow) => {
      clearImpersonationStorageIfCookieMissing()

      if ((listing as { status?: string }).status === "sold") {
        toast.message("This listing has sold — it can’t be edited.")
        router.replace(
          listingDetailPath({
            section: String(listing.section),
            slug: (listing as { slug?: string | null }).slug ?? null,
            id: String(listing.id),
          }),
        )
        return { status: "handled" as const }
      }
      const listingSection = (listing as { section?: string }).section
      if (listingSection !== "surfboards") {
        router.replace(peerListingEditHref(listingSection, String(listing.id)), { scroll: false })
        return { status: "handled" as const }
      }
      setEditListingOwnerId(listing.user_id as string)
      const st = (listing as { status?: string }).status
      setEditListingStatus(typeof st === "string" ? st : null)
      if (st === "draft") {
        setSellServerDraftListingId("surfboards", String(listing.id))
        if (!editId) {
          replaceSellDraftEditUrl("surfboards", String(listing.id))
        }
      }
      if (isAdminListingEditEntry(sellSearchParams)) {
        setImpersonation(await syncClientImpersonationForListingOwner(String(listing.user_id ?? "")))
      }
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
      // Load stored mode; non-admins are coerced to Reswell in an effect below.
      const storedMode = (listing as { board_shipping_cost_mode?: string | null })
        .board_shipping_cost_mode
      const boardShippingCostMode: BoardShippingCostMode =
        storedMode === "flat" || storedMode === "free" || storedMode === "reswell"
          ? storedMode
          : "reswell"
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

      type BrandModelListingEmbed = {
        id?: string
        name?: string | null
        brands?: { slug?: string | null } | { slug?: string | null }[] | null
      }
      const bmRaw = (listing as { brand_models?: BrandModelListingEmbed | BrandModelListingEmbed[] | null })
        .brand_models
      const bmRow = Array.isArray(bmRaw) ? bmRaw[0] : bmRaw
      const brandSlugFromCatalogModel = (() => {
        const b = bmRow?.brands
        const o = Array.isArray(b) ? b[0] : b
        return o?.slug?.trim() ?? ""
      })()
      const listingModelCol = (listing as { model?: string | null }).model?.trim() ?? ""
      const loadedBrandModelId =
        (listing as { brand_model_id?: string | null }).brand_model_id?.trim() ||
        bmRow?.id?.trim() ||
        ""

      const loadedReswellPackage = reswellPackageFormFromDbRow(
        listing as {
          shipping_packed_length_in?: number | string | null
          shipping_packed_width_in?: number | string | null
          shipping_packed_height_in?: number | string | null
          shipping_packed_weight_oz?: number | string | null
        },
      )
      const loadedSurfboardShippingTier =
        parseSurfboardShippingTierId(
          (listing as { shipping_package_tier?: string | null }).shipping_package_tier,
        ) ?? ""
      const explicitPackBand = parseSurfboardShippingPackBandId(
        (listing as { shipping_package_band?: string | null }).shipping_package_band,
      )
      const hasReswellPackageFromDb =
        loadedReswellPackage.reswellPackageLengthIn.trim() !== "" ||
        loadedReswellPackage.reswellPackageWidthIn.trim() !== "" ||
        loadedReswellPackage.reswellPackageHeightIn.trim() !== "" ||
        loadedReswellPackage.reswellPackageWeightLb.trim() !== "" ||
        loadedReswellPackage.reswellPackageWeightOz.trim() !== ""
      // Legacy pack-band listings: prefill the package fields from the fixed carton.
      const packageFromLegacyBand =
        !hasReswellPackageFromDb && explicitPackBand
          ? (() => {
              const band = surfboardShippingPackBandFixedParcel(explicitPackBand)
              return {
                reswellPackageLengthIn: String(band.lengthIn),
                reswellPackageWidthIn: String(band.widthIn),
                reswellPackageHeightIn: String(band.heightIn),
                reswellPackageWeightLb: String(band.weightLb),
                reswellPackageWeightOz: "",
              }
            })()
          : null
      const parsedDims = surfboardSellFormDimensionsFromListingRow(
        listing as {
          dimensions?: string | null
          length_total_inches?: number | null
          volume_liters?: number | null
          title?: string | null
        },
      )
      setFormData({
        title: listing.title ?? "",
        description: (listing.description ?? "").trim() === "" ? "" : (listing.description ?? ""),
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
        surfboardShippingTier: loadedSurfboardShippingTier || "shortboard",
        surfboardShippingTierCeilingConfirmed: true,
        surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
        surfboardShippingPackBandCeilingConfirmed: false,
        // Board `/sell` always uses seller-entered package size for Reswell.
        adminCustomShippingCarton: boardShippingCostMode === "reswell",
        ...(hasReswellPackageFromDb
          ? loadedReswellPackage
          : packageFromLegacyBand ?? {
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
        showPriceMarkdown: (() => {
          const compareAt = Number.parseFloat(
            String((listing as { compare_at_price?: number | string | null }).compare_at_price ?? ""),
          )
          const price = Number.parseFloat(String(listing.price ?? ""))
          return Number.isFinite(compareAt) && Number.isFinite(price) && compareAt > price
        })(),
        loadedPublishedPriceUsd: (() => {
          const n = Number.parseFloat(String(listing.price ?? ""))
          return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
        })(),
        loadedCompareAtPriceUsd: (() => {
          const n = Number.parseFloat(
            String((listing as { compare_at_price?: number | string | null }).compare_at_price ?? ""),
          )
          return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
        })(),
        buyerOffers:
          (listing as { buyer_offers_enabled?: boolean | null }).buyer_offers_enabled !== false,
        boardType: listing.board_type ?? "",
        boardLength: parsedDims.boardLength,
        boardWidthInches: parsedDims.boardWidthInches,
        boardThicknessInches: parsedDims.boardThicknessInches,
        boardVolumeL: parsedDims.boardVolumeL,
        boardFins: singleFinSetupSlugForForm(
          (listing as { fins_setup?: string | null }).fins_setup,
        ),
        boardTail: (listing as { tail_shape?: string | null }).tail_shape ?? "",
        boardFinSystem: (listing as { fin_system?: string | null }).fin_system ?? "",
        boardConstruction: (listing as { construction?: string | null }).construction ?? "",
        boardFinsIncluded: finsIncludedFormValue(
          (listing as { fins_included?: boolean | null }).fins_included,
        ),
        boardBrandId: (listing as { brand_id?: string | null }).brand_id?.trim() ?? "",
        boardBrandModelId: loadedBrandModelId,
        boardIndexBrandSlug: loadedCatalogBrandSlug || brandSlugFromCatalogModel,
        boardIndexModelSlug:
          loadedCatalogModelSlug ||
          (bmRow?.name?.trim() ? slugify(bmRow.name.trim()) : ""),
        boardIndexLabel: (() => {
          const b = (listing as { brand?: string | null }).brand?.trim() ?? ""
          const m = listingModelCol || loadedBoardModelName || bmRow?.name?.trim() || ""
          if (b && m) return `${b} ${m}`.trim()
          return b || m || ""
        })(),
        boardModelName: listingModelCol || loadedBoardModelName || bmRow?.name?.trim() || "",
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
          (a, b) =>
            (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
            (a.sort_order ?? 0) - (b.sort_order ?? 0)
        )
        .map((img) => {
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
            dropSourceFileAfterUpload: true,
          }
        })
      sellListingThumbLoadedSrcByClientId.clear()
      latestListingPhotoPrepareSeqRef.current.clear()
      setImages(existingImages)
      setRemovedImageIds([])

      const existingVideos = (
        (
          listing as {
            listing_videos?: Array<{
              id: string
              url: string
              thumbnail_url?: string | null
              content_type?: string | null
              duration_seconds?: number | null
              byte_size?: number | null
              sort_order?: number | null
            }> | null
          }
        ).listing_videos ?? []
      )
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const firstVideo = existingVideos[0]
      if (firstVideo?.url?.trim()) {
        const thumb = firstVideo.thumbnail_url?.trim() || null
        hydrateExistingVideo(
          createEmptyListingVideoSlot({
            id: firstVideo.id,
            status: "ready",
            url: firstVideo.url,
            thumbnailUrl: thumb,
            previewUrl: thumb || firstVideo.url,
            contentType: firstVideo.content_type ?? null,
            durationSeconds: firstVideo.duration_seconds ?? null,
            byteSize: firstVideo.byte_size ?? null,
          }),
        )
      } else {
        hydrateExistingVideo(null)
      }

      return { status: "ready" as const }
    },
    [editId, hydrateExistingVideo, router, sellSearchParams],
  )

  const { editLoading, showEditSkeleton, editLoadError, retryEditLoad } = useOwnedListingEditLoad({
    editId: loadListingId,
    supabase,
    signInReturnPath: loadListingId ? `/sell?edit=${loadListingId}` : "/sell",
    openSignIn,
    notFoundRedirectHref: "/sell",
    router,
    onNotFound: () => {
      if (!editId) clearSellServerDraftListingId("surfboards")
    },
    onHydrate: hydrateBoardEdit,
  })

  const serverDraft = useSellServerDraft({
    section: "surfboards",
    supabase,
    editId,
    editListingStatus,
    editLoading,
    draftHydrated,
    loading,
    formLooksFilled: () =>
      sellFormSnapshotLooksFilled("board", formData as SellListingDraftFormSnapshot),
    buildDraftPayload: buildBoardDraftPayload,
    imagesRef,
    removedImageIdsRef,
    setImages,
    onStartNewListing: handleStartNewListing,
    startNewListingBusy,
    optimizingAny: images.some((im) => im.optimizePhase === "running"),
    extraDisabled: boardCategoryOptions.length === 0,
    onOpenDraft: onSoftOpenDraft,
    // Guest cookie drafts — same as Quick. Avoids "Sign in to save a draft" nags.
    allowUnsigned: !editId,
  })

  const {
    localServerDraftId,
    draftControls: boardDraftControls,
    showDraftControls: showBoardDraftControls,
    draftSaveStatus: serverDraftSaveStatus,
    persistServerDraftRef,
  } = serverDraft
  const effectiveEditId = editId ?? localServerDraftId
  const resumeDraftId = editId ?? (wantsBlankListing ? null : localServerDraftId)
  const draftRowForImages = effectiveEditId
  const treatAsDraftForSync =
    listingIsDraft || Boolean(localServerDraftId && !editId)

  const boardLengthFormatted = useMemo(
    () => formatBoardLengthForTitle(formData.boardLength),
    [formData.boardLength],
  )

  /**
   * Saved listing areas (profile last-used + local recent). Applied as chips in
   * LocationPicker; the newest pin can auto-fill a brand-new form once.
   */
  const [locationPrefillSuggested, setLocationPrefillSuggested] =
    useState<LocationPrefillSuggested | null>(null)
  const [savedListingLocations, setSavedListingLocations] = useState<
    SellSavedListingLocation[]
  >([])
  const savedLocationAutoAppliedRef = useRef(false)
  useEffect(() => {
    if (editId) return
    let cancelled = false
    const localSaved = readSellSavedListingLocations()
    if (localSaved.length > 0) {
      setSavedListingLocations(localSaved)
    }
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "default_listing_city, default_listing_state, default_listing_lat, default_listing_lng, default_listing_display",
        )
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled) return
      const city = (profile?.default_listing_city ?? "").trim()
      if (!city) return
      const state = (profile?.default_listing_state ?? "").trim()
      const display =
        (profile?.default_listing_display ?? "").trim() ||
        [city, state].filter(Boolean).join(", ")
      const lat =
        typeof profile?.default_listing_lat === "number" &&
        Number.isFinite(profile.default_listing_lat)
          ? profile.default_listing_lat
          : null
      const lng =
        typeof profile?.default_listing_lng === "number" &&
        Number.isFinite(profile.default_listing_lng)
          ? profile.default_listing_lng
          : null

      setLocationPrefillSuggested({
        city,
        state,
        displayLabel: display,
      })

      if (lat != null && lng != null && !(lat === 0 && lng === 0)) {
        const profileLoc: SellSavedListingLocation = {
          city,
          state,
          lat,
          lng,
          displayName: display,
        }
        const merged = rememberSellSavedListingLocation(profileLoc)
        if (!cancelled) setSavedListingLocations(merged)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editId, supabase])

  /** One-time auto-apply of the newest saved pin on a brand-new listing (no draft location yet). */
  useEffect(() => {
    if (editId || !draftHydrated || savedLocationAutoAppliedRef.current) return
    if (savedListingLocations.length === 0) return
    if (sellFormHasCommittedMapPins(formData)) {
      savedLocationAutoAppliedRef.current = true
      return
    }
    const loc = savedListingLocations[0]
    if (!loc) return
    savedLocationAutoAppliedRef.current = true
    setPickupShippingLocationUserCommits((c) => (c > 0 ? c : 1))
    setFormData((f) => {
      if (sellFormHasCommittedMapPins(f)) return f
      return {
        ...f,
        locationLat: loc.lat,
        locationLng: loc.lng,
        locationCity: loc.city,
        locationState: loc.state,
        locationDisplay: loc.displayName,
      }
    })
  }, [
    editId,
    draftHydrated,
    savedListingLocations,
    formData.locationLat,
    formData.locationLng,
    formData.locationCity,
  ])

  /**
   * Auto-derived title: composes "6'0 Brand Model" from the catalog pick and
   * keeps it in sync until the seller edits the title themselves. Cuts the
   * most-skipped required field down to zero typing for catalog boards.
   */
  const lastAutoTitleRef = useRef<string | null>(null)
  useEffect(() => {
    if (editId || !draftHydrated) return
    const brand = formData.brand.trim()
    const model = formData.boardModelName.trim()
    if (!brand && !model) return
    const lengthPart = isBoardLengthEntryComplete(formData.boardLength)
      ? formatBoardLengthForTitle(formData.boardLength)
      : ""
    const suggestion = [lengthPart, brand, model].filter(Boolean).join(" ").trim()
    if (!suggestion || suggestion.length > LISTING_TITLE_MAX_LENGTH) return
    const current = formData.title
    // Untouched = still exactly our last suggestion, or empty and never auto-filled.
    // A seller who clears an auto title has opted out — don't fight the field.
    const untouched =
      current === lastAutoTitleRef.current ||
      (current.trim() === "" && lastAutoTitleRef.current === null)
    if (!untouched || current === suggestion) return
    lastAutoTitleRef.current = suggestion
    setFormData((f) => ({ ...f, title: suggestion }))
  }, [
    draftHydrated,
    editId,
    formData.brand,
    formData.boardModelName,
    formData.boardLength,
    formData.title,
  ])

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
      boardFins: formData.boardFins,
      boardTail: formData.boardTail,
      boardFulfillment: formData.boardFulfillment,
      boardShippingCostMode: formData.boardShippingCostMode,
      boardShippingPrice: formData.boardShippingPrice,
      surfboardShippingTier: formData.surfboardShippingTier,
      surfboardShippingTierCeilingConfirmed: formData.surfboardShippingTierCeilingConfirmed,
      surfboardShippingPackBand: formData.surfboardShippingPackBand,
      surfboardShippingPackBandCeilingConfirmed: formData.surfboardShippingPackBandCeilingConfirmed,
      adminCustomShippingCarton: formData.adminCustomShippingCarton,
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
    sellFormHasCommittedMapPins(formData) ||
    (pickupShippingSectionEnteredOnce && pickupShippingLocationUserCommits > 0)

  const sellSectionCompletion = useMemo((): Record<string, boolean> => {
    const deliveryDataComplete = sellSectionCompletionBase["sell-section-shipping"] === true
    return {
      ...sellSectionCompletionBase,
      "sell-section-shipping": deliveryDataComplete && pickupShippingStepperUxSatisfied,
    }
  }, [pickupShippingStepperUxSatisfied, sellSectionCompletionBase])

  const activeSellSectionId = BOARD_SELL_SECTION_ID_BY_STEP[flowStep]

  const sellStepChecklistBySection = useMemo(
    () =>
      computeSellStepChecklist(sellValidationForm, {
        imageCount: images.length,
        imagesUploadReady,
      }),
    [sellValidationForm, images.length, imagesUploadReady],
  )
  const shippingSetupIncomplete = useMemo(
    () =>
      (sellStepChecklistBySection["sell-section-shipping"] ?? []).some(
        (item) => item.id === "shipping-setup" && !item.complete,
      ),
    [sellStepChecklistBySection],
  )

  /**
   * Quick publish path: flip to pickup-only and clear the shipping config so
   * the seller isn't blocked on package size. Shipping can be added anytime by
   * editing the listing.
   */
  const handleSkipShippingForNow = useCallback(() => {
    setFormData((fd) => ({
      ...fd,
      boardFulfillment: "pickup_only" as BoardFulfillmentChoice,
      boardShippingCostMode: "reswell" as BoardShippingCostMode,
      boardShippingPrice: "",
      surfboardShippingTier: "" as SurfboardShippingTierId | "",
      surfboardShippingTierCeilingConfirmed: false,
      surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
      surfboardShippingPackBandCeilingConfirmed: false,
      adminCustomShippingCarton: true,
      reswellPackageLengthIn: "",
      reswellPackageWidthIn: "",
      reswellPackageHeightIn: "",
      reswellPackageWeightLb: "",
      reswellPackageWeightOz: "",
    }))
  }, [])

  const goToSellSection = useCallback(
    (sectionId: string) => {
      const step = BOARD_SELL_STEP_BY_SECTION_ID[sectionId]
      if (!step) return
      setBoardFlowStep(step)
      if (typeof window === "undefined") return
      if (viewMode === "advanced") {
        const el = document.getElementById(sectionId)
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
          return
        }
      }
      window.scrollTo({ top: 0, behavior: "smooth" })
    },
    [setBoardFlowStep, viewMode],
  )

  const goToNextSellStep = useCallback(() => {
    const next = nextBoardSellFlowStep(flowStep)
    if (!next) return
    setBoardFlowStep(next)
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [flowStep, setBoardFlowStep])

  const goToPrevSellStep = useCallback(() => {
    const prev = prevBoardSellFlowStep(flowStep)
    if (!prev) return
    setBoardFlowStep(prev)
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [flowStep, setBoardFlowStep])

  const firstIncompleteSellSectionId = useMemo(() => {
    for (const item of SELL_FORM_SECTION_NAV_ITEMS) {
      if (sellSectionCompletion[item.id] !== true) return item.id
    }
    return null
  }, [sellSectionCompletion])

  const firstIncompleteSellSectionLabel = useMemo(() => {
    if (!firstIncompleteSellSectionId) return null
    return (
      SELL_FORM_SECTION_NAV_ITEMS.find((i) => i.id === firstIncompleteSellSectionId)?.label ?? null
    )
  }, [firstIncompleteSellSectionId])

  const sellFunnelSectionIds = useMemo(
    () => SELL_FORM_SECTION_NAV_ITEMS.map((item) => item.id),
    [],
  )

  useSellFunnelStepTracking({
    listingType: "surfboards",
    sectionIds: sellFunnelSectionIds,
    sectionCompletion: sellSectionCompletion,
    enabled: !editLoading,
    activeSectionId: activeSellSectionId,
  })

  useEffect(() => {
    if (viewMode === "advanced" || flowStep === "shipping") {
      setPickupShippingSectionEnteredOnce(true)
    }
  }, [flowStep, viewMode])

  useEffect(() => {
    if (skipPickupShippingStepperInteractionUx || editLoading) return
    if (viewMode !== "advanced" && flowStep !== "shipping") return

    let cancelled = false
    let raf = 0
    let attempts = 0
    let detach: (() => void) | undefined

    const attach = () => {
      if (cancelled) return
      const el = document.getElementById("sell-section-shipping")
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
  }, [editLoading, flowStep, viewMode, skipPickupShippingStepperInteractionUx])
  const resolvedTitlePreview = useMemo(
    () => buildResolvedListingTitle(sellValidationForm),
    [sellValidationForm],
  )

  const deliveryFlags = useMemo(
    () => flagsFromBoardFulfillment(formData.boardFulfillment),
    [formData.boardFulfillment],
  )
  const allowPrivilegedShippingUi = actorIsAdmin === true || Boolean(impersonation)
  const reswellShippingSelected =
    deliveryFlags.shipping_available && formData.boardShippingCostMode === "reswell"
  const freeShippingSelected =
    deliveryFlags.shipping_available && formData.boardShippingCostMode === "free"
  const flatShippingSelected =
    deliveryFlags.shipping_available && formData.boardShippingCostMode === "flat"

  const applyBoardShippingOffer = useCallback(
    (enable: boolean, mode: BoardShippingCostMode) => {
      setFormData((fd) => {
        const cur = flagsFromBoardFulfillment(fd.boardFulfillment)
        let ns = enable
        let np = cur.local_pickup
        if (!ns && !np) np = true
        const nextMode = enable ? mode : ("reswell" as BoardShippingCostMode)
        const clearReswellPack = !enable || nextMode === "free" || nextMode === "flat"
        return {
          ...fd,
          boardFulfillment: boardFulfillmentFromChecks(ns, np),
          boardShippingCostMode: nextMode,
          ...(nextMode !== "flat" ? { boardShippingPrice: "" } : {}),
          ...(clearReswellPack
            ? {
                surfboardShippingTier: "" as SurfboardShippingTierId | "",
                surfboardShippingTierCeilingConfirmed: false,
                surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
                surfboardShippingPackBandCeilingConfirmed: false,
                adminCustomShippingCarton: true,
                reswellPackageLengthIn: "",
                reswellPackageWidthIn: "",
                reswellPackageHeightIn: "",
                reswellPackageWeightLb: "",
                reswellPackageWeightOz: "",
              }
            : {
                adminCustomShippingCarton: true,
                surfboardShippingTier: (fd.surfboardShippingTier ||
                  "shortboard") as SurfboardShippingTierId,
                surfboardShippingTierCeilingConfirmed: true,
                surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
                surfboardShippingPackBandCeilingConfirmed: false,
              }),
        }
      })
    },
    [],
  )

  /** Sellers stay Reswell-only; admins may keep free/flat. */
  useEffect(() => {
    if (actorIsAdmin !== false) return
    if (!deliveryFlags.shipping_available) return
    if (formData.boardShippingCostMode === "reswell") return
    setFormData((fd) =>
      fd.boardShippingCostMode === "reswell"
        ? fd
        : { ...fd, boardShippingCostMode: "reswell" as BoardShippingCostMode },
    )
  }, [actorIsAdmin, deliveryFlags.shipping_available, formData.boardShippingCostMode])

  /**
   * Board `/sell` Reswell shipping always uses seller-entered package L×W×H + weight.
   * No pack-band autofill from board dimensions.
   */
  useEffect(() => {
    if (actorIsAdmin === null && !impersonation) return

    setFormData((fd) => {
      const shippingOn = flagsFromBoardFulfillment(fd.boardFulfillment).shipping_available
      if (!shippingOn) return fd

      if (
        allowPrivilegedShippingUi &&
        (fd.boardShippingCostMode === "free" || fd.boardShippingCostMode === "flat")
      ) {
        return fd
      }

      if (
        fd.boardShippingCostMode === "reswell" &&
        fd.adminCustomShippingCarton === true &&
        !fd.surfboardShippingPackBand
      ) {
        return fd
      }

      return {
        ...fd,
        boardShippingCostMode: "reswell" as BoardShippingCostMode,
        adminCustomShippingCarton: true,
        surfboardShippingTier: (fd.surfboardShippingTier || "shortboard") as SurfboardShippingTierId,
        surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
        surfboardShippingTierCeilingConfirmed: true,
        surfboardShippingPackBandCeilingConfirmed: false,
      }
    })
  }, [
    actorIsAdmin,
    impersonation,
    allowPrivilegedShippingUi,
    deliveryFlags.shipping_available,
    formData.boardShippingCostMode,
  ])

  /**
   * `/sell?new=1` — blank form and local snapshot.
   * Depends on `startFresh` (boolean), not the `searchParams` object identity — unstable
   * param references otherwise re-trigger this reset during photo upload.
   */
  useEffect(() => {
    if (!startFresh) return
    if (isPendingPublish("board")) return
    for (const im of imagesRef.current) {
      if (im.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(im.previewUrl)
    }
    draftPhotosPendingRef.current = null
    setFormData(createInitialSellFormData())
    setBoardFlowStep("product")
    setViewModeState("guided")
    persistBoardSellViewMode("guided")
    clearPersistedBoardSellFlowStep()
    sellListingThumbLoadedSrcByClientId.clear()
    latestListingPhotoPrepareSeqRef.current.clear()
    setImages([])
    setRemovedImageIds([])
    setPublishPreview(null)
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) await clearSellListingDraft(user.id)
      await clearGuestSellListingDraft()
      clearSellServerDraftListingId("surfboards")
      try {
        sessionStorage.removeItem(SELL_SUPPRESS_IDB_RESTORE_KEY)
        sessionStorage.removeItem(SELL_PENDING_PUBLISH_KEY)
      } catch {
        /* ignore */
      }
    })()
  }, [setBoardFlowStep, startFresh, supabase])

  useEffect(() => {
    if (!editId) {
      setEditListingStatus(null)
    }
  }, [editId])

  /** Blank /sell: restore local IDB snapshot before hydrating so debounced persist never wipes it. */
  useEffect(() => {
    if (editId) {
      setDraftHydrated(true)
      return
    }
    let cancelled = false
    void (async () => {
      /** Capture before any await: layout may strip `?new=1` while hints load. */
      const wantsBlankListing =
        startFresh ||
        (typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("new") === "1")

      const suppressIdbForNewListing =
        typeof window !== "undefined" &&
        (() => {
          try {
            return sessionStorage.getItem(SELL_SUPPRESS_IDB_RESTORE_KEY) === "1"
          } catch {
            return false
          }
        })()

      const pendingPublishResume = isPendingPublish("board")

      if (
        (pendingPublishResume || (!wantsBlankListing && !suppressIdbForNewListing)) &&
        !getImpersonation()
      ) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!cancelled && user) {
          await migrateGuestSellListingDraftToUser(user.id)
        }
        if (!cancelled) {
          const record = user
            ? await loadSellListingDraft(user.id)
            : await loadGuestSellListingDraft()
          if (record && !cancelled) {
            setFormData(sellFormStateFromIdbSnapshot(record.formData))
            const restoredStep =
              parseBoardSellFlowStep(record.formData.boardFlowStep) ??
              readStoredBoardSellFlowStep()
            if (restoredStep) {
              setFlowStep(restoredStep)
              persistBoardSellFlowStep(restoredStep)
            }
            const blobs = Array.isArray(record.imageBlobs) ? record.imageBlobs : []
            if (blobs.length > 0) {
              const slots = listingPhotoSlotsFromDraftBlobs(blobs)
              if (slots.length > 0) {
                idbRestoreOptimizeQueueRef.current = slots
                latestListingPhotoPrepareSeqRef.current.clear()
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
  }, [editId, startFresh, supabase])

  useEffect(() => {
    const loadActorAdmin = async (
      userId: string | null,
      opts?: { keepExistingIfUnsigned?: boolean },
    ) => {
      if (!userId) {
        if (opts?.keepExistingIfUnsigned) return
        setActorIsAdmin(false)
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle()
      setActorIsAdmin(profile?.is_admin === true)
    }

    void supabase.auth.getUser().then(({ data: { user } }) => {
      setSignedInUserId(user?.id ?? null)
      sellDraftUserIdRef.current = user?.id ?? null
      void loadActorAdmin(user?.id ?? null, { keepExistingIfUnsigned: true })
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null
      sellDraftUserIdRef.current = uid
      setSignedInUserId(uid)
      void loadActorAdmin(uid, { keepExistingIfUnsigned: _event === "INITIAL_SESSION" })
      if (!uid) return
      void migrateGuestSellListingDraftToUser(uid)
      for (const slot of imagesRef.current) {
        if (!slot.sourceFile) continue
        if (slot.uploadPhase === "done") continue
        void optimizeAndUploadSlot(slot)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (editId || !draftHydrated) return
    if (sellDraftPersistTimerRef.current) clearTimeout(sellDraftPersistTimerRef.current)
    sellDraftPersistTimerRef.current = setTimeout(() => {
      sellDraftPersistTimerRef.current = null
      void (async () => {
        const r = sellDraftLatestRef.current
        if (r.editId || !r.draftHydrated) return
        setDraftAutosaveState("saving")
        try {
          await persistSellListingDraftSnapshot({
            listingType: r.listingType,
            formData: r.formData,
            images: r.images,
            userId: sellDraftUserIdRef.current,
          })
          setDraftAutosaveState("saved")
        } catch {
          setDraftAutosaveState("idle")
        }
      })()
    }, 600)
    return () => {
      if (sellDraftPersistTimerRef.current) clearTimeout(sellDraftPersistTimerRef.current)
    }
  }, [editId, draftHydrated, flowStep, formData, images])

  useEffect(() => {
    const flushIdb = () => {
      const r = sellDraftLatestRef.current
      if (r.editId || !r.draftHydrated) return
      void (async () => {
        await persistSellListingDraftSnapshot({
          listingType: r.listingType,
          formData: r.formData,
          images: r.images,
          userId: sellDraftUserIdRef.current,
        })
      })()
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") flushIdb()
    }
    window.addEventListener("pagehide", flushIdb)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("pagehide", flushIdb)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  useEffect(() => {
    if (!loadListingId) setEditListingOwnerId(null)
  }, [loadListingId])

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

  useEffect(() => {
    if (!treatAsDraftForSync || !draftRowForImages || editLoading) return
    if (!videoUploadReady || videoUploading) return
    if (!readyVideo && removedVideoIds.length === 0) return
    const timer = window.setTimeout(() => {
      void syncListingDraftVideosClient(
        supabase,
        draftRowForImages,
        video,
        removedVideoIds,
      )
        .then(({ nextVideo }) => {
          setVideo(nextVideo)
          setRemovedVideoIds([])
        })
        .catch((e) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("[sell] draft listing_videos sync", e)
          }
        })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [
    treatAsDraftForSync,
    draftRowForImages,
    editLoading,
    videoUploadReady,
    videoUploading,
    readyVideo,
    removedVideoIds,
    video,
    setVideo,
    setRemovedVideoIds,
    supabase,
  ])

  function listingPhotoPrepareSeqInSync(clientId: string, prepareSeq: number): boolean {
    return (latestListingPhotoPrepareSeqRef.current.get(clientId) ?? 0) === prepareSeq
  }

  async function optimizeAndUploadSlot(slot: ListingPhotoSlot) {
    const clientId = slot.clientId
    const previewUrl = slot.previewUrl
    const prepareSeq = slot.prepareSeq ?? 0
    latestListingPhotoPrepareSeqRef.current.set(clientId, prepareSeq)
    let prepared = slot.prepared

    try {
      if (!prepared) {
        const src = slot.sourceFile
        if (!src) return
        const file = await ensureBrowserDecodableImageFile(src)
        prepared = await prepareListingImagePairFromFile(file, {
          rotate180: Boolean(slot.userRotate180),
        })
        if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return
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
                }
              : s,
          ),
        )
      }

      if (!prepared) return

      if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return

      let session = await resolveClientSessionForMutation(supabase)
      let user = session?.user ?? null
      if (!session?.access_token || !user) {
        await new Promise((r) => setTimeout(r, 250))
        session = await resolveClientSessionForMutation(supabase)
        user = session?.user ?? null
      }
      if (!session?.access_token || !user) {
        if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return
        setImages((prev) =>
          prev.map((s) =>
            s.clientId === clientId
              ? {
                  ...s,
                  optimizePhase: "done",
                  uploadPhase: "pending_auth",
                  errorMessage: undefined,
                }
              : s,
          ),
        )
        // Keep local previews for guests — auth is gated at Publish, not mid-upload.
        void persistSellListingDraftSnapshot({
          listingType: "board",
          formData: {
            ...formDataRef.current,
            boardFlowStep: flowStep,
          } as SellListingDraftFormSnapshot,
          images: imagesRef.current,
          userId: null,
          includeInFlightPhotos: true,
        }).catch(() => {
          /* best-effort */
        })
        return
      }

      if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return

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

      // No per-tick progress state: the tile only shows a skeleton until upload completes, so
      // streaming XHR progress here just re-rendered the whole (very large) form on every chunk.
      const { fullUrl, thumbUrl } = await uploadListingImagePairToSupabase({
        supabase,
        userId: user.id,
        clientId,
        prepared,
      })

      if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return

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
                ...(s.dropSourceFileAfterUpload ? { sourceFile: undefined } : {}),
              }
            : s,
        ),
      )
    } catch (e) {
      console.error("[sell] listing photo failed", e)
      const msg = friendlyListingPhotoErrorMessage(e, prepared ? "upload" : "add")
      logSellFunnelEvent({
        listingType: "surfboards",
        event: "upload_failed",
        message: msg,
      })
      if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return
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

  usePendingPublishResume({
    listingKind: "board",
    draftHydrated,
    formRef,
    imagesRef,
    editLoading,
  })

  function retryListingPhotoUpload(clientId: string) {
    const live = imagesRef.current.find((s) => s.clientId === clientId)
    if (!live) return
    const nextSeq = (live.prepareSeq ?? 0) + 1
    latestListingPhotoPrepareSeqRef.current.set(clientId, nextSeq)
    const next: ListingPhotoSlot = {
      ...live,
      prepareSeq: nextSeq,
      errorMessage: undefined,
    }
    setImages((prev) =>
      prev.map((s) => (s.clientId === clientId ? next : s)),
    )
    void optimizeAndUploadSlot(next)
  }

  function rotateListingPhoto180(clientId: string) {
    const live = imagesRef.current.find((s) => s.clientId === clientId)
    if (!live) return
    if (live.optimizePhase === "error" || live.uploadPhase === "error") return
    if (live.optimizePhase === "running") return

    if (live.sourceFile) {
      let nextSlot: ListingPhotoSlot | null = null
      setImages((prev) =>
        prev.map((s) => {
          if (s.clientId !== clientId) return s
          const src = s.sourceFile
          if (!src) return s
          if (s.previewUrl.startsWith("blob:")) URL.revokeObjectURL(s.previewUrl)
          sellListingThumbLoadedSrcByClientId.delete(s.clientId)
          const nextSeq = (s.prepareSeq ?? 0) + 1
          latestListingPhotoPrepareSeqRef.current.set(clientId, nextSeq)
          nextSlot = {
            ...s,
            userRotate180: !s.userRotate180,
            prepareSeq: nextSeq,
            prepared: undefined,
            optimizePhase: "running",
            uploadPhase: "idle",
            url: undefined,
            thumbnailUrl: undefined,
            progressFull: 0,
            progressThumb: 0,
            previewUrl: URL.createObjectURL(src),
            errorMessage: undefined,
          }
          return nextSlot
        }),
      )
      if (nextSlot) void optimizeAndUploadSlot(nextSlot)
      return
    }

    const fullUrl = (live.url ?? "").trim()
    if (!fullUrl || live.uploadPhase !== "done") return

    const snapshot: ListingPhotoSlot = { ...live }

    setImages((prev) =>
      prev.map((s) =>
        s.clientId === clientId
          ? { ...s, optimizePhase: "running", errorMessage: undefined }
          : s,
      ),
    )

    void (async () => {
      try {
        const res = await fetch(proxiedListingImageSrc(fullUrl))
        if (!res.ok) {
          throw new Error("Could not load this photo to rotate it.")
        }
        const blob = await res.blob()
        const file = new File(
          [blob],
          "listing-photo.jpg",
          { type: blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg" },
        )

        let nextSlot: ListingPhotoSlot | null = null
        setImages((prev) =>
          prev.map((s) => {
            if (s.clientId !== clientId) return s
            if (s.previewUrl.startsWith("blob:")) URL.revokeObjectURL(s.previewUrl)
            sellListingThumbLoadedSrcByClientId.delete(s.clientId)
            const nextSeq = (s.prepareSeq ?? 0) + 1
            latestListingPhotoPrepareSeqRef.current.set(clientId, nextSeq)
            nextSlot = {
              ...s,
              userRotate180: !s.userRotate180,
              prepareSeq: nextSeq,
              prepared: undefined,
              optimizePhase: "running",
              uploadPhase: "idle",
              url: undefined,
              thumbnailUrl: undefined,
              progressFull: 0,
              progressThumb: 0,
              previewUrl: URL.createObjectURL(file),
              sourceFile: file,
              dropSourceFileAfterUpload: true,
              errorMessage: undefined,
            }
            return nextSlot
          }),
        )
        if (nextSlot) void optimizeAndUploadSlot(nextSlot)
      } catch (e) {
        toast.error(friendlyListingPhotoErrorMessage(e, "rotate"))
        setImages((prev) => prev.map((s) => (s.clientId === clientId ? snapshot : s)))
      }
    })()
  }

  function addListingPhotoFiles(incoming: File[]) {
    const imageFiles = incoming.filter(isListingPhotoFile)
    if (!imageFiles.length) {
      toast.error("Drop one or more image files (JPEG, PNG, HEIC, etc.).")
      return
    }

    const currentCount = imagesRef.current.length
    if (currentCount >= 12) {
      toast.error("Maximum 12 photos allowed.")
      return
    }

    const room = 12 - currentCount
    const toAdd = imageFiles.slice(0, room)
    if (imageFiles.length > room) {
      toast.error(
        `Only ${room} more photo${room === 1 ? "" : "s"} can be added (12 max).`,
      )
    }

    const newSlots: ListingPhotoSlot[] = []
    for (const originalFile of toAdd) {
      try {
        assertListingOriginalSize(originalFile)
      } catch (err) {
        toast.error(friendlyListingPhotoErrorMessage(err))
        continue
      }
      newSlots.push({
        clientId: crypto.randomUUID(),
        previewUrl: URL.createObjectURL(originalFile),
        optimizePhase: "running",
        uploadPhase: "idle",
        progressFull: 0,
        progressThumb: 0,
        sourceFile: originalFile,
      })
    }

    if (!newSlots.length) return

    setImages((prev) => [...prev, ...newSlots])
    for (const slot of newSlots) {
      void optimizeAndUploadSlot(slot)
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    addListingPhotoFiles(Array.from(e.target.files))
    e.target.value = ""
  }

  function handlePhotosFileDragEnter(e: React.DragEvent) {
    if (!isOsFileDragEvent(e)) return
    e.preventDefault()
    photosFileDragDepthRef.current += 1
    setPhotosFileDragActive(true)
  }

  function handlePhotosFileDragLeave(e: React.DragEvent) {
    if (!isOsFileDragEvent(e)) return
    e.preventDefault()
    photosFileDragDepthRef.current -= 1
    if (photosFileDragDepthRef.current <= 0) {
      photosFileDragDepthRef.current = 0
      setPhotosFileDragActive(false)
    }
  }

  function handlePhotosFileDragOver(e: React.DragEvent) {
    if (!isOsFileDragEvent(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  function handlePhotosFileDrop(e: React.DragEvent) {
    if (!isOsFileDragEvent(e)) return
    e.preventDefault()
    e.stopPropagation()
    photosFileDragDepthRef.current = 0
    setPhotosFileDragActive(false)
    addListingPhotoFiles(filesFromDataTransfer(e.dataTransfer))
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const toRemove = prev[index]
      if (toRemove?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(toRemove.previewUrl)
      }
      if (toRemove?.clientId) {
        sellListingThumbLoadedSrcByClientId.delete(toRemove.clientId)
        latestListingPhotoPrepareSeqRef.current.delete(toRemove.clientId)
      }
      if (toRemove?.id) {
        setRemovedImageIds((ids) => [...ids, toRemove.id!])
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  /**
   * Stable, clientId-keyed tile handlers. The ref always points at the latest closures so the
   * `useCallback([])` wrappers below never change identity — letting the memoized photo tiles skip
   * re-rendering when unrelated form state changes (e.g. typing in another field).
   */
  const photoTileActionsRef = useRef({
    remove: (_clientId: string) => {},
    retry: (_clientId: string) => {},
    rotate: (_clientId: string) => {},
  })
  photoTileActionsRef.current.remove = (clientId: string) => {
    const idx = imagesRef.current.findIndex((s) => s.clientId === clientId)
    if (idx >= 0) removeImage(idx)
  }
  photoTileActionsRef.current.retry = retryListingPhotoUpload
  photoTileActionsRef.current.rotate = rotateListingPhoto180

  const handlePhotoTileRemove = useCallback(
    (clientId: string) => photoTileActionsRef.current.remove(clientId),
    [],
  )
  const handlePhotoTileRetry = useCallback(
    (clientId: string) => photoTileActionsRef.current.retry(clientId),
    [],
  )
  const handlePhotoTileRotate = useCallback(
    (clientId: string) => photoTileActionsRef.current.rotate(clientId),
    [],
  )

  // Whole-tile drag: mouse after a short move; touch uses press-and-hold so page scroll still works.
  const photoDragSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
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
      const purge = await purgeListingImageStorageAction({
        listingId,
        imageRowIds: removedIds,
      })
      if ("error" in purge) {
        throw new Error(
          typeof purge.error === "string"
            ? purge.error
            : "Could not remove old photos from storage.",
        )
      }
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
        const url = (img.url ?? "").trim()
        const thumb = (img.thumbnailUrl ?? "").trim()
        const { error } = await supabase
          .from("listing_images")
          .update({
            sort_order: index,
            is_primary: index === 0,
            ...(url
              ? { url, thumbnail_url: thumb || null }
              : {}),
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

  function dismissUploadProgressToast() {
    const tid = uploadToastIdRef.current
    uploadToastIdRef.current = null
    if (tid != null) toast.dismiss(tid)
  }

  const leaveSellDocument = useCallback((href: string) => {
    allowDocumentUnloadRef.current = true
    navigateAfterListingSave(href)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (publishInFlightRef.current) {
      return
    }
    publishInFlightRef.current = true
    allowDocumentUnloadRef.current = false

    const publishStartedAt = Date.now()
    logSellFunnelEvent({
      listingType: "surfboards",
      event: "publish_attempt",
      message: editId ? "edit" : "create",
    })

    const goSubmitStep = (n: number) => {
      submitStepIndexRef.current = n
      setSubmitStepIndex(n)
    }
    goSubmitStep(0)
    dismissUploadProgressToast()
    setPublishValidationBanner(null)

    let retainPublishOverlayUntilNavigation = false
    const revalidateNavSearchOnSuccess = !editId || listingIsDraft

    try {
      // Same session resolution as photo upload — retries through brief auth lock /
      // token-refresh aborts so Save does not surface "signal is aborted without reason".
      const session = await resolveClientSessionForMutation(supabase)
      const user = session?.user
      const accessToken = session?.access_token
      if (!user || !accessToken) {
        await beginGuestListingPublishAuth({
          kind: "board",
          returnPath: "/sell/boards",
          openSignIn,
          persistDraft: () =>
            persistSellListingDraftSnapshot({
              listingType: "board",
              formData: formData as SellListingDraftFormSnapshot,
              images,
              userId: null,
              includeInFlightPhotos: true,
            }),
        })
        return
      }

      // Sync readable cookie → localStorage; never wipe (cookie may be httpOnly).
      clearImpersonationStorageIfCookieMissing()

      let submitActorIsAdmin = actorIsAdmin === true || initialActorIsAdmin === true
      try {
        const { data: actorProfile, error: actorProfileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle()
        if (!actorProfileError && actorProfile) {
          submitActorIsAdmin = actorProfile.is_admin === true
          setActorIsAdmin(submitActorIsAdmin)
        }
      } catch (profileError) {
        // Token-refresh aborts must not drop admin impersonation mid-save.
        if (!isSellSubmitAbortError(profileError) && process.env.NODE_ENV === "development") {
          console.warn("[sell] is_admin lookup:", profileError)
        }
      }

      /** Cookie first, localStorage fallback — APIs still require the HTTP cookie. */
      let storedImpersonation = getActiveImpersonationClient()
      if (storedImpersonation && !submitActorIsAdmin) {
        clearImpersonation()
        setImpersonation(null)
        storedImpersonation = null
      }

      /**
       * Editing your own listing never uses impersonation — drop a stale cookie so Save
       * stays on the normal owner update path (admin flat/free included).
       */
      const editingOwnListing =
        Boolean(editId) &&
        Boolean(editListingOwnerId) &&
        user.id === editListingOwnerId
      if (editingOwnListing && storedImpersonation) {
        clearImpersonation()
        setImpersonation(null)
        storedImpersonation = null
      }

      const listingImpersonation: ImpersonationData | null =
        submitActorIsAdmin && storedImpersonation ? storedImpersonation : null

      const adminImpersonationEditListing = adminIsEditingAnotherUsersListing({
        actorIsAdmin: submitActorIsAdmin,
        actorUserId: user.id,
        listingOwnerId: editListingOwnerId,
      })

      const submitForm = formData

      const imagesUploadReady = !images.some(
        (im) =>
          im.uploadPhase !== "done" ||
          !im.url?.trim() ||
          !im.thumbnailUrl?.trim(),
      )

      if (!videoUploadReady || videoUploading) {
        logSellFunnelEvent({
          listingType: "surfboards",
          event: "validation_failed",
          message: "Video still uploading",
        })
        setPublishValidationBanner("Hang tight — your video is still uploading.")
        window.requestAnimationFrame(() => {
          document
            .getElementById("sell-publish-validation-banner")
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        })
        return
      }

      const sellerPurchaseRaw = submitForm.sellerPurchasePrice?.trim() ?? ""
      if (
        sellerPurchaseRaw &&
        sellerPurchasePriceToDb(submitForm.sellerPurchasePrice) === null
      ) {
        logSellFunnelEvent({
          listingType: "surfboards",
          event: "validation_failed",
          field: "sellerPurchasePrice",
          message: "Invalid seller purchase price",
        })
        setPublishValidationBanner(
          "What you paid: enter a valid dollar amount or leave it blank.",
        )
        window.requestAnimationFrame(() => {
          document
            .getElementById("sell-publish-validation-banner")
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        })
        return
      }

      setLoading(true)
      // Yield one frame so loading overlay / aria-busy can paint before slug DB work (mobile "frozen" tap).
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })

      const allowPrivilegedShipping =
        submitActorIsAdmin || Boolean(listingImpersonation)

      // Ensure Reswell board shipping always persists as seller-entered carton dims.
      let submitFormForSave = submitForm
      if (
        flagsFromBoardFulfillment(submitForm.boardFulfillment).shipping_available &&
        (submitForm.boardShippingCostMode === "reswell" || !submitForm.boardShippingCostMode)
      ) {
        submitFormForSave = {
          ...submitForm,
          boardShippingCostMode: "reswell" as BoardShippingCostMode,
          adminCustomShippingCarton: true,
          surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
          surfboardShippingPackBandCeilingConfirmed: false,
          surfboardShippingTier:
            parseSurfboardShippingTierId(submitForm.surfboardShippingTier) ?? "shortboard",
          surfboardShippingTierCeilingConfirmed: true,
        }
      }

      const validationMessage = validateSellListingForm(
        { listingType: "board", ...submitFormForSave } as SellFormValidationInput,
        {
          imageCount: images.length,
          imagesUploadReady,
          adminImpersonationEdit: adminImpersonationEditListing,
          allowPrivilegedShippingModes: allowPrivilegedShipping,
        },
      )
      if (validationMessage) {
        logSellFunnelEvent({
          listingType: "surfboards",
          event: "validation_failed",
          message: validationMessage,
        })
        setLoading(false)
        setPublishValidationBanner(validationMessage)
        window.requestAnimationFrame(() => {
          document
            .getElementById("sell-publish-validation-banner")
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        })
        return
      }

      const fd = submitFormForSave

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
      const shippingCostMode = fulfillmentFlags.shipping_available
        ? normalizeSellShippingCostMode(fd.boardShippingCostMode, allowPrivilegedShipping)
        : null
      const shippingPriceForPersist = !fulfillmentFlags.shipping_available
        ? null
        : shippingCostMode === "flat"
          ? (() => {
              const n = Number.parseFloat(String(fd.boardShippingPrice ?? "").replace(/,/g, ""))
              return Number.isFinite(n) && n >= 0 ? n : 0
            })()
          : 0

      if (
        allowPrivilegedShipping &&
        fulfillmentFlags.shipping_available &&
        shippingCostMode === "flat" &&
        (fd.boardShippingPrice === "" || Number(fd.boardShippingPrice) < 0)
      ) {
        setLoading(false)
        setPublishValidationBanner("Enter a flat shipping rate.")
        window.requestAnimationFrame(() => {
          document
            .getElementById("sell-publish-validation-banner")
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        })
        return
      }

      const fulfillmentRow = {
        shipping_available: fulfillmentFlags.shipping_available,
        local_pickup: fulfillmentFlags.local_pickup,
        shipping_price: shippingPriceForPersist,
        board_shipping_cost_mode: shippingCostMode,
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
          lat: boardLocationLat ?? undefined,
          lng: boardLocationLng ?? undefined,
          display: fd.locationDisplay.trim() || undefined,
        })
      }

      const resolvedListingTitle = buildResolvedListingTitle({
        listingType: "board",
        ...fd,
      } as SellFormValidationInput)

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
        condition: fd.condition,
        boardType: fd.boardType,
        shippingAvailable: fulfillmentFlags.shipping_available,
        localPickup: fulfillmentFlags.local_pickup,
        listingImages: listingImagesForPublishPreview(images),
      })

      let listingId: string | null = effectiveEditId
      let listingSlug: string | null = null
      let usedImpersonationListingApi = false
      let publishedDraftNeedsSideEffects = false
      const isLocalOnlyServerDraftSubmit = Boolean(localServerDraftId && !editId)

      if (effectiveEditId) {
        if (!isLocalOnlyServerDraftSubmit && editId && !editListingOwnerId) {
          logSellFunnelEvent({
            listingType: "surfboards",
            event: "publish_failed",
            message: "Edit blocked: listing owner still loading",
            durationMs: Date.now() - publishStartedAt,
          })
          dismissUploadProgressToast()
          toast.error("Listing is still loading. Try again in a moment.")
          setLoading(false)
          return
        }
        const ownerEditsOwnListing =
          isLocalOnlyServerDraftSubmit || user.id === editListingOwnerId
        const adminEditsOtherListing = adminIsEditingAnotherUsersListing({
          actorIsAdmin: submitActorIsAdmin,
          actorUserId: user.id,
          listingOwnerId: editListingOwnerId,
        })

        /** Persists surfboard dims on `listings.dimensions` (see migration `20260815120000_listings_dimensions_column.sql`). */
        const dimensionsStored = listingDimensionsColumnFromSurfboardSellForm(fd)
        const packedRow = reswellPackageFieldsToDb(fd)
        const editListingFields = {
          title: resolvedListingTitle,
          description: fd.description,
          price: parseFloat(fd.price),
          condition: fd.condition,
          section: "surfboards" as const,
          category_id: fd.category,
          board_type: resolveListingBoardTypeFromCategory(fd.category, fd.boardType),
          dimensions: dimensionsStored,
          fins_setup: finsSetupFieldForDb(fd.boardFins),
          tail_shape: fd.boardTail ? fd.boardTail : null,
          ...boardBrowseFacetFieldsForDb(fd),
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
          ...listingSurfboardBrandFieldsForDb(fd),
          seller_purchase_price_usd: sellerPurchasePriceToDb(fd.sellerPurchasePrice),
          compare_at_price: resolveCompareAtPriceOnUpdate({
            currentPriceUsd: fd.loadedPublishedPriceUsd ?? parseFloat(fd.price),
            nextPriceUsd: parseFloat(fd.price),
            existingCompareAtUsd: fd.loadedCompareAtPriceUsd,
            showPriceMarkdown: fd.showPriceMarkdown === true,
          }),
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
                  site_visibility_reason: null,
                  slug: publishSlug ?? undefined,
                }
              : {}),
          }
          const persistOwnerListingUpdate = async () => {
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
                  "[sell] DB rejected legacy listing dimension columns; saved without them. Ensure migrations are applied.",
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
                        site_visibility_reason: null,
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
            if (updateError) {
              // Keep the raw abort so retryOnceOnSellSubmitAbort can catch it.
              if (isSellSubmitAbortError(updateError)) throw updateError
              throw new Error(sellSubmitErrorMessage(updateError, "Failed to update listing"))
            }
            return updated
          }
          const updated = await retryOnceOnSellSubmitAbort(persistOwnerListingUpdate, {
            onRetry: async () => {
              await resolveClientSessionForMutation(supabase)
            },
          })
          listingSlug = updated?.slug ?? null
          listingId = effectiveEditId
          persistBoardCatalogSnapshot(effectiveEditId, user.id)
          if (publishingFromDraftRow) {
            requestKlaviyoListingCreated(effectiveEditId)
            // Search-index / merchant sync runs after images are synced below.
            publishedDraftNeedsSideEffects = true
          }
          clearSellServerDraftListingId("surfboards")
        } else if (adminEditsOtherListing) {
          if (!editId || !editListingOwnerId) {
            throw new Error("Listing is still loading. Try again in a moment.")
          }
          await ensureImpersonationForListingOwner(editListingOwnerId)
          setImpersonation(getActiveImpersonationClient())
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
              if (!img.url?.trim() || !img.thumbnailUrl?.trim()) {
                throw new Error(`Photo ${i + 1} is still uploading. Wait or retry before saving.`)
              }
              imageOps.push({
                id: img.id,
                url: img.url,
                thumbnail_url: img.thumbnailUrl,
                is_primary: i === 0,
                sort_order: i,
              })
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
          const updated = await updateImpersonatedListingViaApi({
            listingId: editId,
            listing: editListingFields,
            removedImageIds,
            images: imageOps,
            removedVideoIds,
            videos: readyVideo ? [readyVideo] : [],
            catalog_snapshot: boardCatalogSnapshotFromSellForm(fd),
            publishFromDraft: listingIsDraft,
          })
          if (!updated.ok) {
            throw new Error(sellActionErrorMessage(updated.error || "Failed to update listing"))
          }
          listingSlug = updated.slug
          if (updated.published === true) {
            setEditListingStatus("active")
          }
          goSubmitStep(2)
        } else {
          dismissUploadProgressToast()
          toast.error(
            submitActorIsAdmin
              ? "This listing isn’t on your account. Sign in as the listing owner to edit it, or start impersonation for that seller first."
              : "This listing belongs to another account. Sign in as the listing owner to edit it.",
          )
          setLoading(false)
          return
        }
      } else {
        /** Persists surfboard dims on `listings.dimensions` (see migration `20260815120000_listings_dimensions_column.sql`). */
        const dimensionsStoredNew = listingDimensionsColumnFromSurfboardSellForm(fd)
        const packedRowNew = reswellPackageFieldsToDb(fd)
        const listingFields = {
          title: resolvedListingTitle,
          description: fd.description,
          price: parseFloat(fd.price),
          condition: fd.condition,
          section: "surfboards" as const,
          category_id: fd.category,
          board_type: resolveListingBoardTypeFromCategory(fd.category, fd.boardType),
          dimensions: dimensionsStoredNew,
          fins_setup: finsSetupFieldForDb(fd.boardFins),
          tail_shape: fd.boardTail ? fd.boardTail : null,
          ...boardBrowseFacetFieldsForDb(fd),
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
          ...listingSurfboardBrandFieldsForDb(fd),
          seller_purchase_price_usd: sellerPurchasePriceToDb(fd.sellerPurchasePrice),
          compare_at_price: null,
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
              videos: readyVideo
                ? [
                    {
                      url: readyVideo.url,
                      thumbnail_url: readyVideo.thumbnailUrl,
                      content_type: readyVideo.contentType,
                      duration_seconds: readyVideo.durationSeconds,
                      byte_size: readyVideo.byteSize,
                      sort_order: readyVideo.sortOrder,
                    },
                  ]
                : [],
              catalog_snapshot: boardCatalogSnapshotFromSellForm(fd),
            }),
          })
          const data = (await res.json().catch(() => ({}))) as {
            error?: string
            listing_id?: string
            slug?: string
          }
          if (!res.ok) {
            throw new Error(sellActionErrorMessage(data.error || "Failed to create listing"))
          }
          listingId = data.listing_id
          listingSlug = data.slug
          goSubmitStep(2)
        } else {
          const newSlug = await generateUniqueListingSlug(supabase, resolvedListingTitle)
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
                "[sell] DB rejected legacy listing dimension columns; saved without them. Ensure migrations are applied.",
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
            throw new Error(sellSubmitErrorMessage(listingError, "Failed to create listing"))
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
            // Roll back the just-created listing so a photo failure never
            // leaves an orphaned active listing; the user can retry cleanly.
            await supabase
              .from("listings")
              .delete()
              .eq("id", listing.id)
              .eq("user_id", user.id)
            listingId = null
            throw new Error(sellSubmitErrorMessage(imagesInsertError, "Failed to save listing photos"))
          }
          if (readyVideo) {
            const { error: videoInsertError } = await supabase.from("listing_videos").insert({
              listing_id: listingId,
              url: readyVideo.url,
              thumbnail_url: readyVideo.thumbnailUrl,
              content_type: readyVideo.contentType,
              duration_seconds: readyVideo.durationSeconds,
              byte_size: readyVideo.byteSize,
              sort_order: 0,
            })
            if (videoInsertError) {
              await supabase
                .from("listings")
                .delete()
                .eq("id", listing.id)
                .eq("user_id", user.id)
              listingId = null
              throw new Error(
                sellSubmitErrorMessage(videoInsertError, "Failed to save listing video"),
              )
            }
          }
          requestKlaviyoListingCreated(String(listing.id))
          await applyBoardListingPublishedSideEffectsAction(String(listing.id)).catch((err) => {
            if (process.env.NODE_ENV === "development") {
              console.warn("[sell] publish side effects:", err)
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
          if (publishedDraftNeedsSideEffects) {
            await applyBoardListingPublishedSideEffectsAction(listingId).catch((err) => {
              if (process.env.NODE_ENV === "development") {
                console.warn("[sell] publish side effects:", err)
              }
            })
          }
          void clearSellListingDraft(user.id)
          persistDefaultListingLocalityForProfile()
          dismissUploadProgressToast()
          void revalidateListingDetailAfterListingMutation({
            listingId,
            slug: listingSlug,
          }).catch((err) => {
            if (process.env.NODE_ENV === "development") {
              console.warn("[sell] listing-detail cache revalidation:", err)
            }
          })
          if (revalidateNavSearchOnSuccess) {
            void revalidateNavSearchSuggestAfterListingPublished().catch((err) => {
              if (process.env.NODE_ENV === "development") {
                console.warn("[sell] nav search suggest cache revalidation:", err)
              }
            })
          }

          logSellFunnelEvent({
            listingType: "surfboards",
            event: "publish_succeeded",
            listingId: listingId ?? undefined,
            durationMs: Date.now() - publishStartedAt,
          })
          setJustPublishedListingMarker({
            listingId,
            slug: listingSlug ?? null,
            section: "surfboards",
          })
          retainPublishOverlayUntilNavigation = true
          setPublishPreview((p) =>
            p
              ? {
                  ...p,
                  status: "live",
                  listingId,
                  slug: listingSlug,
                  detailHref: detailPath,
                  listingImages: listingImagesForPublishPreview(imagesRef.current),
                }
              : null,
          )
          setLoading(false)
          return
        }
        if (editId && !usedImpersonationListingApi) {
          const willSyncNewPhotos = images.some((im) => !im.id && im.url)
          if (willSyncNewPhotos) goSubmitStep(1)
          await syncListingImages(listingId)
          const { nextVideo } = await syncListingDraftVideosClient(
            supabase,
            listingId,
            video,
            removedVideoIds,
          )
          setVideo(nextVideo)
          setRemovedVideoIds([])
          goSubmitStep(2)
        }
        if (publishedDraftNeedsSideEffects) {
          await applyBoardListingPublishedSideEffectsAction(listingId).catch((err) => {
            if (process.env.NODE_ENV === "development") {
              console.warn("[sell] publish side effects:", err)
            }
          })
        }
      }

      goSubmitStep(2)
      void clearSellListingDraft(user.id)
      persistDefaultListingLocalityForProfile()
      dismissUploadProgressToast()
      if (listingId) {
        void revalidateListingDetailAfterListingMutation({
          listingId,
          slug: listingSlug,
        }).catch((err) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("[sell] listing-detail cache revalidation:", err)
          }
        })
        if (revalidateNavSearchOnSuccess) {
          void revalidateNavSearchSuggestAfterListingPublished().catch((err) => {
            if (process.env.NODE_ENV === "development") {
              console.warn("[sell] nav search suggest cache revalidation:", err)
            }
          })
        }
      }
      logSellFunnelEvent({
        listingType: "surfboards",
        event: "publish_succeeded",
        listingId: listingId ?? undefined,
        durationMs: Date.now() - publishStartedAt,
      })
      retainPublishOverlayUntilNavigation = true
      if (!editId && listingId) {
        const { resolveAdminBulkListingAfterCreate } = await import(
          "@/lib/utils/admin-bulk-listing-navigation"
        )
        if (
          resolveAdminBulkListingAfterCreate(router, {
            bulkSlotId,
            listingId,
            slug: listingSlug ?? "",
            title: resolvedListingTitle,
            section: "surfboards",
            defaultDetailPath: detailPath,
          })
        ) {
          allowDocumentUnloadRef.current = true
          setPublishPreview(null)
          setLoading(false)
          return
        }
      }
      // Fresh publish (new listing or draft going live) — never a plain edit.
      if (listingId && (!editId || publishedDraftNeedsSideEffects)) {
        setJustPublishedListingMarker({
          listingId,
          slug: listingSlug ?? null,
          section: "surfboards",
        })
      }
      if (listingImpersonation) {
        leaveSellDocument(detailPath)
        return
      }
      if (listingId) {
        setPublishPreview((p) =>
          p
            ? {
                ...p,
                status: "live",
                listingId,
                slug: listingSlug,
                detailHref: detailPath,
                listingImages: listingImagesForPublishPreview(imagesRef.current),
              }
            : null,
        )
        setLoading(false)
        return
      }
      leaveSellDocument(detailPath)
    } catch (error: unknown) {
      const aborted = isSellSubmitAbortError(error)
      const msg = sellSubmitErrorMessage(error, "Failed to create listing")
      if (!aborted) {
        console.error("Error creating listing:", msg, error)
      }
      logSellFunnelEvent({
        listingType: "surfboards",
        event: "publish_failed",
        message: aborted ? "aborted" : msg,
        durationMs: Date.now() - publishStartedAt,
      })
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
      uploadToastIdRef.current = null
      if (tid != null) toast.dismiss(tid)
      toast.error(aborted ? SELL_SUBMIT_INTERRUPTED_MESSAGE : "Something went wrong. Please try again.", {
        duration: 8000,
        ...(aborted ? {} : { description: msg }),
        action: {
          label: "Retry",
          onClick: () => formRef.current?.requestSubmit(),
        },
      })
    } finally {
      publishInFlightRef.current = false
      if (!retainPublishOverlayUntilNavigation) {
        setLoading(false)
      }
    }
  }

  const optimizingAny = images.some((im) => im.optimizePhase === "running")

  /** Covers publish gate (in-flight, live, or error) and rare early loading without preview. */
  const fullscreenSellBlocking =
    Boolean(publishPreview) || (loading && !editLoading)
  const showBoardModeHeader = !editId && !editLoading && !getImpersonation()

  if (editLoadError) {
    return (
      <SellEditLoadError
        message={editLoadError}
        onRetry={retryEditLoad}
        backHref="/sell"
        backLabel="Back to sell"
      />
    )
  }

  return (
      <main
        className={cn(
          "flex-1 w-full",
          SELL_PAGE_GROUND_CLASS,
          !fullscreenSellBlocking && "pb-20 md:pb-20 lg:pb-24",
          !fullscreenSellBlocking && !showBoardModeHeader && "pt-8",
        )}
      >
        {impersonation && (!editId || isAdminListingEditEntry(sellSearchParams)) ? (
          <ImpersonationActingAsStrip
            target={impersonation}
            onExit={() => {
              void (async () => {
                try {
                  await fetch("/api/admin/impersonate", {
                    method: "DELETE",
                    credentials: "include",
                  })
                } finally {
                  clearImpersonation()
                  setImpersonation(null)
                }
              })()
            }}
          />
        ) : null}
        <AdminBulkListingBanner section="surfboards" bulkSlotId={bulkSlotId} />
        <div className="container relative mx-auto max-w-3xl min-h-[50vh] px-4 sm:px-6 lg:max-w-6xl">
          {publishPreview ? (
            <SellListingPublishedScreen
              listing={{
                id: publishPreview.listingId || "publishing",
                slug: publishPreview.slug ?? null,
                user_id: signedInUserId ?? "",
                title: publishPreview.title,
                price: publishPreview.price,
                status: publishPreview.status === "live" ? "active" : "draft",
                section: "surfboards",
                local_pickup: publishPreview.localPickup,
                shipping_available: publishPreview.shippingAvailable,
                listing_images: publishPreview.listingImages,
                board_type: publishPreview.boardType,
                condition: publishPreview.condition,
              }}
              viewerUserId={signedInUserId}
              status={publishPreview.status}
              errorMessage={publishPreview.errorMessage}
              failedStepLabel={publishPreview.failedStepLabel}
              onViewLiveListing={() => {
                if (publishPreview.detailHref) {
                  leaveSellDocument(publishPreview.detailHref)
                }
              }}
              onRetry={() => formRef.current?.requestSubmit()}
              onDismissError={() => {
                setPublishPreview(null)
                setLoading(false)
              }}
            />
          ) : loading && !editLoading ? (
            <SellPublishingGenericLoaderPortal />
          ) : null}
          <div
            className={cn(fullscreenSellBlocking && "hidden")}
            aria-hidden={fullscreenSellBlocking ? true : undefined}
          >
          <h1 className="sr-only">
            {editId ? "Edit listing" : "Create a Listing"}
          </h1>
          {showBoardModeHeader ? (
            <SellBoardModeHeader
              leading={
                <h1 className="hidden text-3xl font-bold tracking-tight text-foreground sm:block sm:text-4xl sm:leading-tight">
                  Create a listing
                </h1>
              }
              actions={
                showBoardDraftControls ||
                (!editLoading && (!editId || listingIsDraft) && !getImpersonation()) ? (
                  <>
                    {boardDraftControls}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      aria-label="Exit listing form"
                      asChild
                    >
                      <Link href={sellListingsHubHref}>
                        <X className="h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                  </>
                ) : undefined
              }
              status={
                !editId && serverDraftSaveStatus === "idle" && draftAutosaveState !== "idle" ? (
                  <>
                    {draftAutosaveState === "saved" ? (
                      <Check className="h-3.5 w-3.5 text-listingHeart" aria-hidden />
                    ) : null}
                    <span>
                      {draftAutosaveState === "saving"
                        ? "Saving draft…"
                        : "Draft saved on this device"}
                    </span>
                  </>
                ) : undefined
              }
            />
          ) : (
            <div className={cn("mx-auto px-4 pt-10 sm:pt-12", SELL_FORM_COLUMN_CLASS)}>
              <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                <div className="min-w-0 flex-1">
                  <h1 className="hidden text-3xl font-bold tracking-tight text-foreground sm:block sm:text-4xl sm:leading-tight">
                    {editId ? "Edit listing" : "Create a listing"}
                  </h1>
                </div>
                <div className="flex flex-col gap-1 shrink-0 sm:items-end">
                  {(showBoardDraftControls ||
                    (!editLoading && (!editId || listingIsDraft) && !getImpersonation())) && (
                      <div className="flex w-full items-center gap-3 sm:w-auto sm:justify-end">
                        {boardDraftControls}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-auto sm:ml-0"
                          aria-label="Exit listing form"
                          asChild
                        >
                          <Link href={sellListingsHubHref}>
                            <X className="h-4 w-4" aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    )}
                  {!editId && serverDraftSaveStatus === "idle" ? (
                    <div
                      className="flex min-h-5 items-center gap-1.5 sm:justify-end"
                      aria-live="polite"
                    >
                      {draftAutosaveState !== "idle" ? (
                        <>
                          {draftAutosaveState === "saved" ? (
                            <Check
                              className="h-3.5 w-3.5 text-listingHeart"
                              aria-hidden
                            />
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {draftAutosaveState === "saving"
                              ? "Saving draft…"
                              : "Draft saved on this device"}
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {!editLoading && publishValidationBanner ? (
            <Alert
              id="sell-publish-validation-banner"
              variant="destructive"
              className="mb-6"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Before you publish</AlertTitle>
              <AlertDescription>
                <p className="mb-3">{publishValidationBanner}</p>
                <div className="flex flex-wrap gap-2">
                  {firstIncompleteSellSectionId ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => goToSellSection(firstIncompleteSellSectionId)}
                    >
                      Go to {firstIncompleteSellSectionLabel ?? "section"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 bg-background text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => setPublishValidationBanner(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {!editLoading &&
          isAdminListingEditEntry(sellSearchParams) &&
          getImpersonation() &&
          listingIsDraft ? (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Seller draft</AlertTitle>
              <AlertDescription>
                You are editing this seller&apos;s draft as admin. Finish any missing fields, then
                use <span className="font-medium">Publish listing</span> to make it live.
              </AlertDescription>
            </Alert>
          ) : null}

          {showEditSkeleton ? (
            <div
              role="status"
              aria-label="Loading listing editor"
              className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
            >
              <SellFlowFormColumnSkeleton />
            </div>
          ) : (
            <div
              aria-busy={editLoading || undefined}
              className={cn(
                "flex w-full flex-col gap-10 transition-opacity lg:flex-row lg:items-stretch lg:gap-12 xl:gap-16",
                editLoading && "pointer-events-none opacity-60",
              )}
            >
              <aside className="hidden shrink-0 lg:block lg:w-56 xl:w-64">
                <div className="sticky top-24">
                  <SellSectionNav
                    items={SELL_FORM_SECTION_NAV_ITEMS}
                    sectionCompletion={sellSectionCompletion}
                    activeSectionId={activeSellSectionId}
                    onSelectSection={goToSellSection}
                    className="static"
                  />
                </div>
              </aside>
              <div className={cn("min-w-0", SELL_FORM_COLUMN_CLASS)}>
                <SellSectionNavMobileProgress
                  items={SELL_FORM_SECTION_NAV_ITEMS}
                  activeSectionId={activeSellSectionId}
                  className={cn("mb-6 sm:hidden", viewMode === "advanced" && "hidden")}
                />
                <SellSectionNavHorizontal
                  items={SELL_FORM_SECTION_NAV_ITEMS}
                  sectionCompletion={sellSectionCompletion}
                  activeSectionId={activeSellSectionId}
                  onSelectSection={goToSellSection}
                  className={cn(
                    "mb-8 hidden sm:block lg:hidden",
                    viewMode === "advanced" && "sm:hidden",
                  )}
                />
                <form
              ref={formRef}
              onSubmit={(e) => {
                if (viewMode === "guided" && flowStep !== "shipping") {
                  e.preventDefault()
                  goToNextSellStep()
                  return
                }
                void handleSubmit(e)
              }}
              className="space-y-12 lg:space-y-14"
              aria-busy={loading}
            >
                {viewMode === "advanced" || flowStep === "product" ? (
                <SellFormSection
                  sectionId="sell-section-product"
                  title="Product Info"
                  description="Brand, model, title, condition, and board details."
                  complete={sellSectionCompletion["sell-section-product"] === true}
                >
                    <div className="space-y-8">
                      {catalogSelectionCard &&
                      formData.boardBrandId === catalogSelectionCard.brandId ? (
                        <SellCatalogSelectionCard
                          selection={catalogSelectionCard}
                          onRemove={() => {
                            setCatalogSelectionCard(null)
                            setFormData((f) => ({
                              ...f,
                              boardBrandId: "",
                              boardBrandModelId: "",
                              boardIndexBrandSlug: "",
                              boardIndexModelSlug: "",
                              boardIndexLabel: "",
                              boardLinkedBrandName: "",
                            }))
                          }}
                        />
                      ) : null}
                      <div className="space-y-4">
                          <div className="space-y-3">
                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="listing-brand">Brand</Label>
                            <SurfboardTitleIndexInput
                              id="listing-brand"
                              placeholder=""
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
                                    boardBrandModelId: "",
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
                                  boardBrandModelId: "",
                                  boardIndexBrandSlug: opt.brandSlug,
                                  boardIndexModelSlug: opt.modelSlug,
                                  boardIndexLabel: opt.label,
                                  boardModelName: modelFromCatalog,
                                  brand: opt.brandName,
                                  boardLinkedBrandName: opt.brandName,
                                }))
                              }}
                              onRequestBrand={openListingCatalogRequestFromBrand}
                            />
                          </div>

                          <SellBoardModelField
                            directoryBrandId={formData.boardBrandId}
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
                              boardBrandModelId: "",
                              boardIndexBrandSlug: "",
                              boardIndexModelSlug: "",
                              boardIndexLabel: "",
                              boardModelName: "",
                              boardLinkedBrandName: "",
                            }))
                          }}
                        />

                      <Separator className="bg-border" />

                      <div className="space-y-1.5">
                        <div className="flex items-end justify-between gap-2">
                          <Label htmlFor="listing-title">
                            Title{" "}
                            <SellRequiredMark
                              complete={
                                Boolean(formData.title.trim()) &&
                                resolvedTitlePreview.length <= LISTING_TITLE_MAX_LENGTH
                              }
                            />
                          </Label>
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
                        <Input
                          id="listing-title"
                          className={SELL_CONTROL_CLASS}
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

                      <div className="space-y-1.5">
                        <Label htmlFor="sell-condition">
                          Condition{" "}
                          <SellRequiredMark complete={Boolean(formData.condition.trim())} />
                        </Label>
                        <Select
                          value={formData.condition}
                          onValueChange={(value) => setFormData({ ...formData, condition: value })}
                        >
                          <SelectTrigger id="sell-condition" className={SELL_CONTROL_CLASS}>
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

                      <Separator className="bg-border" />

                      <div className="space-y-5">
                      <div className="space-y-2">
                        {!sellCategoriesLoaded ? (
                          <>
                            <Label className="text-sm font-medium text-foreground">
                              Board shape / category{" "}
                              <SellRequiredMark complete={Boolean(formData.category.trim())} />
                            </Label>
                            <p className="text-sm text-muted-foreground">Loading categories…</p>
                          </>
                        ) : boardCategoryOptions.length === 0 ? (
                          <>
                            <Label className="text-sm font-medium text-foreground">
                              Board shape / category{" "}
                              <SellRequiredMark complete={Boolean(formData.category.trim())} />
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              No board categories found — add rows with board = true in public.categories.
                            </p>
                          </>
                        ) : (
                          <SellFacetChipGroup
                            label={
                              <>
                                Board shape / category{" "}
                                <SellRequiredMark
                                  complete={Boolean(formData.category.trim())}
                                />
                              </>
                            }
                            value={formData.category}
                            options={boardCategoryOptions}
                            onValueChange={(value) => {
                              if (!value) {
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
                            disabled={editLoading}
                          />
                        )}
                      </div>
                    </div>
                    </div>
                </SellFormSection>
                ) : null}

                {viewMode === "advanced" || flowStep === "photos" ? (
                <SellFormSection
                  sectionId="sell-section-photos"
                  title="Photos & Description"
                  description="Add photos, board size, and a short description."
                  complete={sellSectionCompletion["sell-section-photos"] === true}
                >
                  <div className="space-y-8">
                    <div className="space-y-1.5">
                      <p className="text-[15px] font-semibold text-foreground">
                        Upload photos of your board{" "}
                        <span className="text-destructive" aria-hidden>
                          *
                        </span>
                      </p>
                      <p className="text-[15px] leading-relaxed text-muted-foreground">
                        Clear, well-lit shots sell faster. Square photos work best — the first
                        becomes your cover. Optional: add one short video beside your photos.
                      </p>
                    </div>
                    <SellListingPhotoGrid
                      images={images}
                      maxPhotos={12}
                      fileInputId={listingPhotosInputId}
                      photosFileDragActive={photosFileDragActive}
                      onImageInputChange={handleImageChange}
                      onDragEnter={handlePhotosFileDragEnter}
                      onDragLeave={handlePhotosFileDragLeave}
                      onDragOver={handlePhotosFileDragOver}
                      onDrop={handlePhotosFileDrop}
                      onDragEnd={handlePhotosDragEnd}
                      onRemove={handlePhotoTileRemove}
                      onRetry={handlePhotoTileRetry}
                      onRotate180={handlePhotoTileRotate}
                      photoDragSensors={photoDragSensors}
                      hideHeader
                      belowGrid={<SellPhotoExamplesBanner />}
                      video={video}
                      videoFileInputId={listingVideoInputId}
                      onVideoInputChange={handleVideoInputChange}
                      onVideoRemove={handleVideoRemove}
                      onVideoRetry={handleVideoRetry}
                    />

                    <Separator className="bg-border" />

                    <div className="space-y-5">
                      {modelStockSizes.length > 0 ? (
                        <SellBoardStockSizePicker
                          modelName={formData.boardModelName.trim() || null}
                          sizes={modelStockSizes}
                          selectedId={selectedStockSizeId}
                          mode={stockSizeMode}
                          onSelectSize={handleSelectStockSize}
                          onChooseCustom={handleChooseCustomStockSize}
                          required={deliveryFlags.shipping_available}
                          complete={
                            isBoardLengthEntryComplete(formData.boardLength) &&
                            isTapeStyleInchesEntryComplete(formData.boardWidthInches) &&
                            isTapeStyleInchesEntryComplete(formData.boardThicknessInches)
                          }
                          disabled={editLoading}
                        />
                      ) : null}
                      {modelStockSizes.length === 0 || stockSizeMode === "custom" ? (
                        <SellBoardDimensionsPicker
                          values={{
                            boardLength: formData.boardLength,
                            boardWidthInches: formData.boardWidthInches,
                            boardThicknessInches: formData.boardThicknessInches,
                            boardVolumeL: formData.boardVolumeL,
                          }}
                          onChange={(patch) =>
                            setFormData((fd) => ({ ...fd, ...patch }))
                          }
                          dimensionsRequired={deliveryFlags.shipping_available}
                          disabled={editLoading}
                        />
                      ) : null}
                      <SellBoardFacetFields
                        boardFins={formData.boardFins}
                        boardFinSystem={formData.boardFinSystem}
                        boardConstruction={formData.boardConstruction}
                        boardFinsIncluded={formData.boardFinsIncluded}
                        onBoardFinsChange={(boardFins) =>
                          setFormData((fd) => ({ ...fd, boardFins }))
                        }
                        onBoardFinSystemChange={(boardFinSystem) =>
                          setFormData((fd) => ({ ...fd, boardFinSystem }))
                        }
                        onBoardConstructionChange={(boardConstruction) =>
                          setFormData((fd) => ({ ...fd, boardConstruction }))
                        }
                        onBoardFinsIncludedChange={(boardFinsIncluded) =>
                          setFormData((fd) => ({ ...fd, boardFinsIncluded }))
                        }
                        disabled={editLoading}
                      />
                    </div>

                    <Separator className="bg-border" />

                    <SellListingDescriptionField
                      id="description"
                      value={formData.description}
                      onChange={(description) => setFormData({ ...formData, description })}
                      placeholder="Describe your board…"
                      maxLength={1000}
                    />
                  </div>
                </SellFormSection>
                ) : null}

                {viewMode === "advanced" || flowStep === "pricing" ? (
                <SellFormSection
                  sectionId="sell-section-pricing"
                  title="Pricing"
                  description="Set your list price and optional offer settings."
                  complete={sellSectionCompletion["sell-section-pricing"] === true}
                >
                <div className="space-y-10">
                  <SellPriceFields
                    listingPrice={formData.price}
                    onListingPriceChange={(value) =>
                      setFormData({ ...formData, price: value })
                    }
                    sellerPurchasePrice={formData.sellerPurchasePrice}
                    onSellerPurchasePriceChange={(value) =>
                      setFormData({ ...formData, sellerPurchasePrice: value })
                    }
                    showPurchasePrice={false}
                    publishedPriceUsd={formData.loadedPublishedPriceUsd}
                    existingCompareAtPriceUsd={formData.loadedCompareAtPriceUsd}
                    showPriceMarkdown={formData.showPriceMarkdown === true}
                    onShowPriceMarkdownChange={(value) =>
                      setFormData({ ...formData, showPriceMarkdown: value })
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
                              className="mt-0.5 shrink-0 data-[state=checked]:bg-listingHeart"
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
                                Lowest price after 2 weeks ($){" "}
                                <SellRequiredMark
                                  complete={priceDropFloorComplete(
                                    formData.autoPriceDropFloor,
                                    formData.price,
                                  )}
                                />
                              </Label>
                              <Input
                                id="sell-auto-price-drop-floor"
                                type="number"
                                inputMode="decimal"
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
                                className="h-11 border-foreground/20 bg-card shadow-sm placeholder:text-muted-foreground"
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
                            className="mt-0.5 shrink-0 data-[state=checked]:bg-listingHeart"
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
                    }
                  />

                  <Separator className="bg-border" />

                </div>
                </SellFormSection>
                ) : null}

                {viewMode === "advanced" || flowStep === "shipping" ? (
                <SellFormSection
                  sectionId="sell-section-shipping"
                  title="Shipping"
                  description="Pin where the board is, then choose pickup or shipping."
                  complete={sellSectionCompletion["sell-section-shipping"] === true}
                >
                  <div className="space-y-10">
                    <div className="space-y-6">
                      <LocationPicker
                        key={
                          sellFormHasCommittedMapPins(formData)
                            ? `loc-${formData.locationLat.toFixed(5)}-${formData.locationLng.toFixed(5)}`
                            : "loc-empty"
                        }
                        onLocationSelect={(loc) => {
                          setPickupShippingLocationUserCommits((c) => c + 1)
                          setFormData((f) => ({
                            ...f,
                            locationLat: loc.lat,
                            locationLng: loc.lng,
                            locationCity: loc.city,
                            locationState: loc.state,
                            locationDisplay: loc.displayName,
                          }))
                          const saved = rememberSellSavedListingLocation({
                            city: loc.city,
                            state: loc.state,
                            lat: loc.lat,
                            lng: loc.lng,
                            displayName: loc.displayName,
                          })
                          setSavedListingLocations(saved)
                          if (!getImpersonation() && loc.city.trim()) {
                            void saveDefaultListingLocationAction({
                              city: loc.city.trim(),
                              state: loc.state.trim() || undefined,
                              lat: loc.lat,
                              lng: loc.lng,
                              display: loc.displayName.trim() || undefined,
                            })
                          }
                        }}
                        onLocationClear={() => {
                          setPickupShippingLocationUserCommits(0)
                          setFormData((f) => ({
                            ...f,
                            locationLat: 0,
                            locationLng: 0,
                            locationCity: "",
                            locationState: "",
                            locationDisplay: "",
                          }))
                        }}
                        prefillSuggested={locationPrefillSuggested}
                        savedLocations={savedListingLocations}
                        initialLat={formData.locationLat || undefined}
                        initialLng={formData.locationLng || undefined}
                        initialCity={formData.locationCity}
                        initialState={formData.locationState}
                        initialDisplay={formData.locationDisplay}
                      />

                      <div className="space-y-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:space-y-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 space-y-0.5 sm:space-y-1">
                            <h3 className="text-sm font-semibold text-foreground sm:text-base">
                              How will buyers get this board?
                            </h3>
                            <p className="text-xs text-muted-foreground sm:text-sm">
                              You can offer shipping, local pickup, or both.
                            </p>
                          </div>
                          <SellRequiredMark
                            complete={
                              deliveryFlags.local_pickup || deliveryFlags.shipping_available
                            }
                          />
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          <div
                            className={cn(
                              "rounded-lg border p-3 transition-colors sm:rounded-xl sm:p-5",
                              reswellShippingSelected
                                ? "border-foreground bg-background shadow-sm"
                                : "border-border",
                            )}
                          >
                          <div className="flex items-start gap-2.5 sm:gap-3">
                            <Checkbox
                              id="sell-delivery-shipping"
                              checked={reswellShippingSelected}
                              onCheckedChange={(v) => {
                                applyBoardShippingOffer(v === true, "reswell")
                              }}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
                              <div className="space-y-1">
                                <Label
                                  htmlFor="sell-delivery-shipping"
                                  className="flex cursor-pointer flex-wrap items-center gap-1.5 text-xs font-semibold leading-snug sm:gap-2 sm:text-sm"
                                >
                                  <span>Have Reswell calculate the shipping cost for buyers</span>
                                  <Badge
                                    variant="default"
                                    className="h-auto border-0 bg-listingHeart px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-white hover:bg-[#2a4170] sm:px-2 sm:py-0.5 sm:text-[10px]"
                                  >
                                    Recommended
                                  </Badge>
                                </Label>
                                <SmoothCollapse open={reswellShippingSelected}>
                                  <div className="pt-1 sm:pt-2">
                                    <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
                                      <span className="sm:hidden">
                                        Buyers pay at checkout. We email the UPS label.
                                      </span>
                                      <span className="hidden sm:inline">
                                        Buyers pay shipping at checkout; we email you the UPS
                                        label. Enter the outer box size and weight you&apos;ll
                                        ship in.
                                      </span>
                                    </p>
                                  </div>
                                </SmoothCollapse>
                                <SmoothCollapse
                                  open={reswellShippingSelected}
                                >
                                  <div className="pt-2 sm:pt-3">
                                    <ReswellPackageDimensionsCard
                                      showHeading
                                      exactCartonMode
                                      lengthPlaceholder="0"
                                      className="border-0 bg-transparent p-0 shadow-none sm:border sm:bg-card sm:p-5 sm:shadow-sm"
                                      lengthIn={formData.reswellPackageLengthIn}
                                      widthIn={formData.reswellPackageWidthIn}
                                      heightIn={formData.reswellPackageHeightIn}
                                      weightLb={formData.reswellPackageWeightLb}
                                      weightOz={formData.reswellPackageWeightOz}
                                      onLengthInChange={(v) =>
                                        setFormData({
                                          ...formData,
                                          // Packed box length is outer inches (not board feet'inches).
                                          reswellPackageLengthIn: normalizeTapeStyleInchesInput(v),
                                        })
                                      }
                                      onWidthInChange={(v) =>
                                        setFormData({
                                          ...formData,
                                          reswellPackageWidthIn:
                                            normalizeTapeStyleInchesInput(v),
                                        })
                                      }
                                      onHeightInChange={(v) =>
                                        setFormData({
                                          ...formData,
                                          reswellPackageHeightIn:
                                            normalizeTapeStyleInchesInput(v),
                                        })
                                      }
                                      onWeightLbChange={(v) =>
                                        setFormData({
                                          ...formData,
                                          reswellPackageWeightLb: v,
                                        })
                                      }
                                      onWeightOzChange={(v) =>
                                        setFormData({
                                          ...formData,
                                          reswellPackageWeightOz: v,
                                        })
                                      }
                                    />
                                  </div>
                                </SmoothCollapse>
                              </div>
                            </div>
                          </div>
                          </div>
                          {allowPrivilegedShippingUi ? (
                            <>
                              <div
                                className={cn(
                                  "rounded-lg border p-3 transition-colors sm:rounded-xl sm:p-5",
                                  freeShippingSelected
                                    ? "border-foreground bg-background shadow-sm"
                                    : "border-border",
                                )}
                              >
                                <div className="flex items-start gap-2.5 sm:gap-3">
                                  <Checkbox
                                    id="sell-delivery-shipping-free"
                                    checked={freeShippingSelected}
                                    onCheckedChange={(v) => {
                                      applyBoardShippingOffer(v === true, "free")
                                    }}
                                    className="mt-0.5"
                                  />
                                  <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                                    <Label
                                      htmlFor="sell-delivery-shipping-free"
                                      className="flex cursor-pointer flex-wrap items-center gap-1.5 text-xs font-semibold leading-snug sm:gap-2 sm:text-sm"
                                    >
                                      <span>Offer free shipping</span>
                                      <Badge
                                        variant="secondary"
                                        className="h-auto px-1.5 py-0 text-[9px] uppercase sm:px-2 sm:py-0.5 sm:text-[10px]"
                                      >
                                        Admin
                                      </Badge>
                                    </Label>
                                    <SmoothCollapse open={freeShippingSelected} className="duration-200">
                                      <p className="pt-0.5 text-xs leading-snug text-muted-foreground sm:pt-1 sm:text-sm sm:leading-relaxed">
                                        Buyer pays $0 for shipping at checkout. You arrange
                                        fulfillment with any carrier — not through Reswell UPS
                                        labels.
                                      </p>
                                    </SmoothCollapse>
                                  </div>
                                </div>
                              </div>
                              <div
                                className={cn(
                                  "rounded-lg border p-3 transition-colors sm:rounded-xl sm:p-5",
                                  flatShippingSelected
                                    ? "border-foreground bg-background shadow-sm"
                                    : "border-border",
                                )}
                              >
                                <div className="flex items-start gap-2.5 sm:gap-3">
                                  <Checkbox
                                    id="sell-delivery-shipping-flat"
                                    checked={flatShippingSelected}
                                    onCheckedChange={(v) => {
                                      applyBoardShippingOffer(v === true, "flat")
                                    }}
                                    className="mt-0.5"
                                  />
                                  <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                                    <Label
                                      htmlFor="sell-delivery-shipping-flat"
                                      className="flex cursor-pointer flex-wrap items-center gap-1.5 text-xs font-semibold leading-snug sm:gap-2 sm:text-sm"
                                    >
                                      <span>Set a flat shipping rate</span>
                                      <Badge
                                        variant="secondary"
                                        className="h-auto px-1.5 py-0 text-[9px] uppercase sm:px-2 sm:py-0.5 sm:text-[10px]"
                                      >
                                        Admin
                                      </Badge>
                                    </Label>
                                    <SmoothCollapse open={flatShippingSelected} className="duration-200">
                                      <div className="space-y-3 pt-1 sm:pt-2">
                                        <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
                                          One dollar amount buyers in the Continental U.S. pay at
                                          checkout. You arrange fulfillment with any carrier — not
                                          through Reswell UPS labels.
                                        </p>
                                        <div className="space-y-2 rounded-lg border border-border bg-background p-4 sm:p-5">
                                          <Label
                                            htmlFor="sell-surfboard-shipping-price"
                                            className="text-sm font-semibold text-foreground"
                                          >
                                            Shipping price{" "}
                                            <SellRequiredMark
                                              complete={flatShippingRateComplete(
                                                formData.boardShippingPrice,
                                              )}
                                            />
                                          </Label>
                                          <div className="relative max-w-md">
                                            <span
                                              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground"
                                              aria-hidden
                                            >
                                              $
                                            </span>
                                            <Input
                                              id="sell-surfboard-shipping-price"
                                              type="number"
                                              inputMode="decimal"
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
                                              className="h-11 border-foreground/20 bg-card pl-8 tabular-nums shadow-sm placeholder:text-muted-foreground"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </SmoothCollapse>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : null}
                          <div
                            className={cn(
                              "flex items-start gap-2.5 rounded-lg border p-3 sm:gap-3 sm:rounded-xl sm:p-5",
                              deliveryFlags.local_pickup
                                ? "border-foreground bg-background shadow-sm"
                                : "border-border",
                            )}
                          >
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
                              className="cursor-pointer pt-0.5 text-xs font-semibold leading-snug sm:text-sm"
                            >
                              Local pickup
                            </Label>
                          </div>
                        </div>
                        {deliveryFlags.shipping_available && shippingSetupIncomplete ? (
                          <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2.5 sm:px-4 sm:py-3">
                            <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
                              Not ready to set up shipping?{" "}
                              <button
                                type="button"
                                onClick={handleSkipShippingForNow}
                                className="font-medium text-foreground underline underline-offset-2 hover:text-listingHeart"
                              >
                                Skip it for now
                              </button>{" "}
                              and publish with local pickup only — you can add shipping anytime by
                              editing your listing.
                            </p>
                          </div>
                        ) : null}
                      </div>

                    </div>
                  </div>

                {!loading ? (
                  <Button
                    type="submit"
                    size="lg"
                    className={cn(
                      "w-full relative transition-shadow",
                      SELL_PRIMARY_BUTTON_CLASS,
                    )}
                  >
                    {editId ? (listingIsDraft ? "Publish listing" : "Save changes") : "Create Listing"}
                  </Button>
                ) : null}
                </SellFormSection>
                ) : null}

                <BoardSellViewToolbar
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  searchAgainHref={
                    !editId && cameFromCatalogSearch ? "/sell" : null
                  }
                  showBack={viewMode === "guided" && flowStep !== "product"}
                  showContinue={viewMode === "guided" && flowStep !== "shipping"}
                  onBack={goToPrevSellStep}
                  onContinue={goToNextSellStep}
                  disabled={loading || editLoading}
                />
                </form>
              </div>
            </div>
              )}
          </div>
        </div>
      </main>
  )
}

const SellPageContent = React.memo(SellPageContentInner)

export default function SellFlowShell(props: {
  /** From the incoming request URL (RSC); merged with live `useSearchParams` client-side */
  urlEditListingId: string | null
  initialActorIsAdmin?: boolean
}) {
  return <SellSearchParamsBridge {...props} />
}

/**
 * Reads URL params client-side and supports soft draft switches.
 * Soft opens use history.replaceState (same as autosave) so changing `?edit=`
 * never hits `app/sell/loading.tsx` / the route Suspense skeleton.
 */
function SellSearchParamsBridge(props: {
  urlEditListingId: string | null
  initialActorIsAdmin?: boolean
}) {
  const searchParams = useSearchParams()
  const qEditRaw = searchParams.get("edit")
  const urlEditId =
    typeof qEditRaw === "string" && qEditRaw.trim() !== ""
      ? qEditRaw.trim()
      : props.urlEditListingId

  /** Next serializes query on SSR + client transitions; avoids relying solely on Suspense spinner */
  const startFresh = searchParams.get("new") === "1"

  /**
   * Local override for draft picker opens. `history.replaceState` updates the
   * address bar without notifying `useSearchParams`, so we keep the active
   * edit id here until a real App Router navigation syncs the URL.
   */
  const [softEditId, setSoftEditId] = useState<string | null>(null)

  useEffect(() => {
    setSoftEditId(null)
  }, [urlEditId, startFresh])

  const editId = softEditId ?? urlEditId

  const onSoftOpenDraft = useCallback((draftId: string) => {
    if (!draftId) return
    setSoftEditId(draftId)
    setSellServerDraftListingId("surfboards", draftId)
    replaceSellDraftEditUrl("surfboards", draftId)
  }, [])

  return (
    <SellPageContent
      editId={editId}
      startFresh={startFresh}
      onSoftOpenDraft={onSoftOpenDraft}
      initialActorIsAdmin={props.initialActorIsAdmin}
    />
  )
}
