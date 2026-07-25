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
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { purgeListingImageStorageAction } from "@/lib/actions/listingImageStoragePurge"
import { peerListingEditHref } from "@/lib/peer-listing-sections"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
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
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCw,
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
import { useOwnedListingEditLoad } from "@/components/features/sell/hooks/use-owned-listing-edit-load"
import {
  sellFormSnapshotLooksFilled,
  useSellServerDraft,
} from "@/components/features/sell/hooks/use-sell-server-draft"
import { clearSellServerDraftListingId, getSellServerDraftListingId, replaceSellDraftEditUrl, setSellServerDraftListingId } from "@/lib/sell-draft-local-meta"
import { AdminBulkListingBanner } from "@/components/features/sell/admin-bulk-listing-banner"
import { SellShippingCostModeRadios } from "@/components/features/sell/sell-shipping-cost-mode-radios"
import { normalizeSellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import { SellBoardModelField } from "@/components/sell-board-model-field"
import { listingDetailPath } from "@/lib/listing-query"
import { revalidateListingDetailAfterListingMutation } from "@/app/actions/listing-detail-cache"
import { revalidateNavSearchSuggestAfterListingPublished } from "@/app/actions/nav-search-suggest-cache"
import { saveDefaultListingLocationAction } from "@/app/actions/sell-default-location"
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
import { LISTING_CONDITION_SELL_OPTIONS, sellFormConditionValue } from "@/lib/listing-labels"
import {
  formatBoardLengthForTitle,
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
  normalizeVolumeLitersInput,
  shouldShowLengthInchHint,
} from "@/lib/board-measurements"
import {
  boardBrowseFacetFieldsForDb,
  finsSetupFieldForDb,
} from "@/lib/listing-facet-write"
import { singleFinSetupSlugForForm } from "@/lib/listing-fin-setup-tags"
import {
  listingDimensionsColumnFromSurfboardSellForm,
  surfboardSellFormDimensionsFromListingRow,
} from "@/lib/listing-dimensions-storage"
import {
  parseSurfboardShippingTierId,
  surfboardShippingTierAutofillFromSelection,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import {
  parseSurfboardShippingPackBandId,
  resolveSurfboardUpsShippingAvailability,
  surfboardShippingPackBandFixedParcel,
  type SurfboardShippingPackBandId,
} from "@/lib/surfboard-shipping-pack-bands"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { SellBoardFacetFields } from "@/components/features/sell/sell-board-facet-fields"
import { SellPriceFields } from "@/components/features/sell/sell-price-fields"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import {
  SellSectionNav,
  SellSectionNavHorizontal,
  SELL_FORM_SECTION_NAV_ITEMS,
} from "@/components/features/sell/sell-section-nav"
import { computeSellSectionCompletion } from "@/lib/sell-section-completion"
import {
  boardCategoryMap,
  boardTypeFromCategoryId,
  resolveListingBoardTypeFromCategory,
} from "@/lib/utils/board-type-from-category-id"
import {
  orderSurfboardSellCategoryOptions,
  staticSellBoardCategoryOptions,
  SELL_BOARD_CATEGORY_UNSELECTED_LABEL,
  SELL_BOARD_CATEGORY_UNSELECTED_VALUE,
  type SellCategoryOptionRow,
} from "@/lib/surfboard-sell-categories"
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"
import { upsertUserListingBoardModelDataFromSellForm } from "@/lib/db/user-listing-board-model-data"
import {
  SELL_SUPPRESS_IDB_RESTORE_KEY,
  sellPendingPublishKey,
} from "@/lib/sell-flow/session-keys"

function scrollSellFormSectionIntoView(sectionId: string) {
  const el = document.getElementById(sectionId)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

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

function SellFlowPublishingInterior({
  preview,
  uploadPhaseLabels,
  submitStepIndex,
  listingSubmitProgressValue,
}: {
  preview: PublishPreviewState
  uploadPhaseLabels: string[]
  submitStepIndex: number
  listingSubmitProgressValue: number
}) {
  const thumb = proxiedListingImageSrc(preview.coverUrl) || "/placeholder.svg"
  const stepLabel = uploadPhaseLabels[submitStepIndex] ?? "Working…"

  return (
    <div
      className="relative w-full max-w-md animate-in fade-in zoom-in-95 motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:zoom-in-100 duration-300"
      aria-busy="true"
      aria-live="polite"
      aria-label={`Publishing listing: ${preview.title}`}
    >
      <div className="rounded-2xl border border-border bg-card p-6 shadow-md sm:p-7">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Publishing
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Finishing up your listing
          </h2>
          <p className="text-sm text-muted-foreground">
            You&apos;ll go to your live listing when everything is saved.
          </p>
        </div>

        <div className="mb-6 flex gap-4">
          <div className="relative h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted shadow-inner">
            <Image
              src={thumb}
              alt=""
              fill
              className="object-cover object-center"
              unoptimized
            />
          </div>
          <div className="flex min-h-[4.75rem] min-w-0 flex-1 flex-col justify-center gap-2">
            <p className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
              {preview.title}
            </p>
            <Skeleton className="h-3 w-[88%]" />
            <Skeleton className="h-3 w-3/5" />
            <p className="text-xs tabular-nums text-muted-foreground">${preview.price}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-muted/30 p-4 ring-1 ring-border/50">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
            <span>{stepLabel}</span>
          </p>
          <Progress value={listingSubmitProgressValue} className="h-1.5" />
        </div>
      </div>
    </div>
  )
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

/**
 * Full-viewport takeover (ported to document.body — `.page-enter` applies transform on ancestors,
 * which traps `position:fixed` so the footer stays visible underneath).
 */
function SellFlowPublishingFullscreenPortal(props: {
  preview: PublishPreviewState
  uploadPhaseLabels: string[]
  submitStepIndex: number
  listingSubmitProgressValue: number
}) {
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
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-y-auto overscroll-none bg-background p-6 sm:p-10 motion-safe:animate-in motion-safe:fade-in motion-reduce:animate-none motion-reduce:opacity-100 duration-200"
      role="presentation"
    >
      <div className="flex min-h-0 w-full max-w-xl flex-1 flex-col justify-center py-8">
        <SellFlowPublishingInterior {...props} />
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

/**
 * Remembers decoded thumbnails per slot across reorder/remount (dnd-kit). Without this,
 * `thumbLoaded` resets while Next/Image often skips `onLoadingComplete` for cached assets,
 * so tiles stay on the skeleton indefinitely after drag.
 */
const sellListingThumbLoadedSrcByClientId = new Map<string, string>()

const SellListingPhotoSortableTile = React.memo(function SellListingPhotoSortableTile({
  image,
  index,
  onRemove,
  onRetry,
  onRotate180,
}: {
  image: ListingPhotoSlot
  index: number
  /** Stable, clientId-keyed handlers so this memoized tile is not invalidated on every parent render. */
  onRemove: (clientId: string) => void
  onRetry: (clientId: string) => void
  onRotate180: (clientId: string) => void
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
      onRemove={() => onRemove(image.clientId)}
      onRetry={() => onRetry(image.clientId)}
      onRotate180={() => onRotate180(image.clientId)}
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
})

function SellListingPhotoTile({
  image,
  index,
  onRemove,
  onRetry,
  onRotate180,
  sortable,
}: {
  image: ListingPhotoSlot
  index: number
  onRemove: () => void
  onRetry: () => void
  onRotate180: () => void
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
  const localPreview =
    image.optimizePhase === "done" && image.previewUrl.startsWith("blob:")
      ? image.previewUrl
      : ""
  const thumbSrc = remote
    ? (proxiedListingImageSrc(remote) ?? remote)
    : localPreview
  const photoReady = Boolean(thumbSrc)

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
    (image.optimizePhase === "running" ||
      image.uploadPhase === "uploading" ||
      (Boolean(thumbSrc) && !thumbLoaded))

  const canRotate180 =
    !isFailure &&
    (Boolean(image.sourceFile) ||
      (image.uploadPhase === "done" && Boolean((image.url ?? "").trim())))

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        ...sortable.style,
        // Inline touchAction — Tailwind utilities are unreliable with dnd-kit on iOS.
        touchAction: sortable.isDragging ? "none" : "pan-y",
      }}
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden bg-muted flex flex-col border border-transparent select-none",
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
            draggable={false}
            className={cn(
              "pointer-events-none object-cover object-center transition-opacity duration-500 ease-out motion-reduce:duration-150 [-webkit-touch-callout:none]",
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
            <div
              className={cn(
                "absolute inset-x-1 top-1 z-[5] flex gap-1 pointer-events-none",
                canRotate180 ? "justify-between" : "justify-end",
              )}
            >
              {canRotate180 ? (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onRotate180}
                  className={cn(
                    "pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full touch-manipulation hover:bg-background sm:h-9 sm:w-9",
                    skeletonVisible
                      ? "bg-background/90 shadow-sm ring-1 ring-black/5"
                      : "bg-background/80",
                  )}
                  aria-label={`Rotate photo ${index + 1} 180 degrees`}
                  title="Rotate 180°"
                >
                  <RotateCw className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onRemove}
                className={cn(
                  "pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full touch-manipulation hover:bg-background sm:h-9 sm:w-9",
                  skeletonVisible
                    ? "bg-background/90 shadow-sm ring-1 ring-black/5"
                    : "bg-background/80",
                )}
                aria-label={`Remove photo ${index + 1}`}
              >
                <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              </button>
            </div>
            {skeletonVisible ? (
              <span className="sr-only">
                {photoReady ? "Loading thumbnail preview" : "Processing photo"}
              </span>
            ) : (
              <div className="absolute bottom-1 left-1 z-[5] flex items-center gap-1 pointer-events-none">
                {index === 0 ? (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1 rounded">
                    Main
                  </span>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </div>
      {isFailure ? (
        <div className="shrink-0 p-1 bg-destructive/10 border-t border-destructive/20 space-y-1">
          <p className="text-[9px] text-destructive line-clamp-2">
            {image.errorMessage || "Couldn't add photo"}
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
  const base = {
    ...createInitialSellFormData(),
    ...snapshot,
  } as ReturnType<typeof createInitialSellFormData>
  return {
    ...base,
    // Surfboard /sell is Reswell shipping only — coerce legacy free/flat drafts.
    boardShippingCostMode: "reswell" as BoardShippingCostMode,
    boardFins: singleFinSetupSlugForForm(snapshot.boardFins),
    boardFinSystem:
      typeof snapshot.boardFinSystem === "string" ? snapshot.boardFinSystem : base.boardFinSystem,
    boardConstruction:
      typeof snapshot.boardConstruction === "string"
        ? snapshot.boardConstruction
        : base.boardConstruction,
  }
}

/**
 * Reswell /sell shipping is UPS-parcel only (shortboard pack bands under the UPS DIM cap).
 * Larger boards cannot enable shipping.
 */
function resolveSellReswellShipping(input: {
  boardLength: string
  boardWidthInches: string
}): {
  tierId: SurfboardShippingTierId | ""
  suggestedPackBandId: SurfboardShippingPackBandId | ""
  shippingSupported: boolean
} {
  const avail = resolveSurfboardUpsShippingAvailability({
    boardLength: input.boardLength,
    boardWidthInches: input.boardWidthInches,
  })
  if (!avail.shippingSupported) {
    return { tierId: "", suggestedPackBandId: "", shippingSupported: false }
  }
  if (!avail.suggestedPackBandId) {
    return { tierId: "", suggestedPackBandId: "", shippingSupported: true }
  }
  return {
    tierId: "shortboard",
    suggestedPackBandId: avail.suggestedPackBandId,
    shippingSupported: true,
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
}): Promise<void> {
  const built = await buildSellListingDraft(
    args.listingType,
    args.formData,
    listingPhotoSlotsForDraftPersist(args.images),
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
    boardFins: "",
    boardTail: "",
    boardFinSystem: "",
    boardConstruction: "",
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
}

function SellPageContentInner({ editId, startFresh }: SellPageContentProps) {
  const listingPhotosInputId = useId()
  const router = useRouter()
  const sellSearchParams = useSearchParams()
  const bulkSlotId = sellSearchParams.get("bulk")?.trim() || null
  const wantsBlankListing = startFresh || sellSearchParams.get("new") === "1"
  const openSignIn = useSignInGate()
  const supabase = useMemo(() => createClient(), [])

  /** Strip `?new=1` from the URL after blank-listing setup; keep `type=surfboard` so /sell stays on the flow. */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    if (startFresh) {
      try {
        sessionStorage.setItem(SELL_SUPPRESS_IDB_RESTORE_KEY, "1")
      } catch {
        /* quota / private mode */
      }
      router.replace("/sell?type=surfboard", { scroll: false })
    }
  }, [startFresh, router])

  const [impersonation, setImpersonation] = useState<ImpersonationData | null>(null)
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  const [actorIsAdmin, setActorIsAdmin] = useState<boolean | null>(null)
  useEffect(() => {
    clearImpersonationStorageIfCookieMissing()
    setImpersonation(getImpersonation())
  }, [])

  const [loading, setLoading] = useState(false)
  const [publishValidationBanner, setPublishValidationBanner] = useState<string | null>(null)
  const [submitStepIndex, setSubmitStepIndex] = useState(0)
  const submitStepIndexRef = useRef(0)
  const [publishPreview, setPublishPreview] = useState<PublishPreviewState | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  /** Prevents concurrent publishes (double-tap / stacked submits before `loading` flips). */
  const publishInFlightRef = useRef(false)
  const pendingPublishHandledRef = useRef(false)
  /** Avoid stacking sign-in modals when several photos are added while signed out. */
  const photoUploadSignInPromptedRef = useRef(false)
  const uploadToastIdRef = useRef<string | number | null>(null)
  const uploadPhaseLabelsRef = useRef<string[]>([...LISTING_UPLOAD_STEP_LABELS])
  const [uploadPhaseLabels, setUploadPhaseLabels] = useState<string[]>(() => [
    ...LISTING_UPLOAD_STEP_LABELS,
  ])
  const [draftHydrated, setDraftHydrated] = useState(!!editId)
  const [editListingStatus, setEditListingStatus] = useState<string | null>(null)
  const [signedInUserId, setSignedInUserId] = useState<string | null>(null)
  /** Guests exit to browse; signed-in sellers to their listings hub (`/listings` → dashboard). */
  const sellListingsHubHref = signedInUserId ? "/dashboard/listings" : "/boards"
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
  const [listingCatalogRequestVariant, setListingCatalogRequestVariant] =
    useState<ListingCatalogRequestVariant | null>(null)
  const [formData, setFormData] = useState(createInitialSellFormData)

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
    formData: formData as SellListingDraftFormSnapshot,
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
      sellListingThumbLoadedSrcByClientId.clear()
      latestListingPhotoPrepareSeqRef.current.clear()
      setImages([])
      setRemovedImageIds([])
      setPublishPreview(null)
      clearSellServerDraftListingId("surfboards")
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) await clearSellListingDraft(user.id)
      await clearGuestSellListingDraft()
      toast.message("Starting a new listing — saved drafts stay in your dashboard.")
      if (editId) {
        router.replace("/sell?type=surfboard&new=1", { scroll: false })
      }
    } finally {
      setStartNewListingBusy(false)
    }
  }, [editId, router, supabase])

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
    (listing: OwnedListingForEditRow, sessionUserId: string) => {
      clearImpersonationStorageIfCookieMissing()
      const imp = getImpersonation()

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
      // Keep impersonation only when editing that seller’s listing (not your own).
      const keepImpersonation =
        imp != null &&
        imp.userId === listing.user_id &&
        sessionUserId !== listing.user_id
      if (imp && !keepImpersonation) {
        clearImpersonation()
        setImpersonation(null)
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
      const loadedSurfboardShippingPackBand =
        loadedSurfboardShippingTier === "shortboard"
          ? parseSurfboardShippingPackBandId(
              (listing as { shipping_package_band?: string | null }).shipping_package_band,
            ) ?? "shortboard_max"
          : ""
      const hasReswellPackageFromDb =
        loadedReswellPackage.reswellPackageLengthIn.trim() !== "" ||
        loadedReswellPackage.reswellPackageWidthIn.trim() !== "" ||
        loadedReswellPackage.reswellPackageHeightIn.trim() !== "" ||
        loadedReswellPackage.reswellPackageWeightLb.trim() !== "" ||
        loadedReswellPackage.reswellPackageWeightOz.trim() !== ""
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
        surfboardShippingTier: loadedSurfboardShippingTier,
        // Re-confirm ceiling on edit so sellers acknowledge the max-size policy.
        surfboardShippingTierCeilingConfirmed: false,
        surfboardShippingPackBand: loadedSurfboardShippingPackBand,
        surfboardShippingPackBandCeilingConfirmed: false,
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
      return { status: "ready" as const }
    },
    [editId, router],
  )

  const { editLoading, editLoadError, retryEditLoad } = useOwnedListingEditLoad({
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
  })

  const { localServerDraftId, draftControls: boardDraftControls } = serverDraft
  const effectiveEditId = editId ?? localServerDraftId
  const resumeDraftId = editId ?? (wantsBlankListing ? null : localServerDraftId)
  const draftRowForImages = effectiveEditId
  const treatAsDraftForSync =
    listingIsDraft || Boolean(localServerDraftId && !editId)

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
      boardFins: formData.boardFins,
      boardTail: formData.boardTail,
      boardFulfillment: formData.boardFulfillment,
      boardShippingCostMode: formData.boardShippingCostMode,
      boardShippingPrice: formData.boardShippingPrice,
      surfboardShippingTier: formData.surfboardShippingTier,
      surfboardShippingTierCeilingConfirmed: formData.surfboardShippingTierCeilingConfirmed,
      surfboardShippingPackBand: formData.surfboardShippingPackBand,
      surfboardShippingPackBandCeilingConfirmed: formData.surfboardShippingPackBandCeilingConfirmed,
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
    const deliveryDataComplete = sellSectionCompletionBase["sell-section-delivery"] === true
    return {
      ...sellSectionCompletionBase,
      "sell-section-delivery": deliveryDataComplete && pickupShippingStepperUxSatisfied,
    }
  }, [pickupShippingStepperUxSatisfied, sellSectionCompletionBase])

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
  })

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

  const sellReswellShipping = useMemo(
    () =>
      resolveSellReswellShipping({
        boardLength: formData.boardLength,
        boardWidthInches: formData.boardWidthInches,
      }),
    [formData.boardLength, formData.boardWidthInches],
  )

  /** Reswell parcel fields follow the selected tier ceiling (or shortboard pack band). */
  useEffect(() => {
    if (!deliveryFlags.shipping_available || formData.boardShippingCostMode !== "reswell") {
      return
    }

    const tierId = parseSurfboardShippingTierId(formData.surfboardShippingTier)
    if (!tierId) return

    const bandId =
      tierId === "shortboard"
        ? parseSurfboardShippingPackBandId(formData.surfboardShippingPackBand)
        : null
    const parcelFill = bandId
      ? (() => {
          const band = surfboardShippingPackBandFixedParcel(bandId)
          return {
            reswellPackageLengthIn: String(band.lengthIn),
            reswellPackageWidthIn: String(band.widthIn),
            reswellPackageHeightIn: String(band.heightIn),
            reswellPackageWeightLb: String(band.weightLb),
            reswellPackageWeightOz: "",
          }
        })()
      : surfboardShippingTierAutofillFromSelection(tierId)

    setFormData((fd) => {
      if (!flagsFromBoardFulfillment(fd.boardFulfillment).shipping_available) return fd
      if (fd.boardShippingCostMode !== "reswell") return fd
      if (parseSurfboardShippingTierId(fd.surfboardShippingTier) !== tierId) return fd
      if (
        tierId === "shortboard" &&
        parseSurfboardShippingPackBandId(fd.surfboardShippingPackBand) !== bandId
      ) {
        return fd
      }
      if (
        fd.reswellPackageLengthIn === parcelFill.reswellPackageLengthIn &&
        fd.reswellPackageWidthIn === parcelFill.reswellPackageWidthIn &&
        fd.reswellPackageHeightIn === parcelFill.reswellPackageHeightIn &&
        fd.reswellPackageWeightLb === parcelFill.reswellPackageWeightLb &&
        fd.reswellPackageWeightOz === parcelFill.reswellPackageWeightOz
      ) {
        return fd
      }
      return {
        ...fd,
        reswellPackageLengthIn: parcelFill.reswellPackageLengthIn ?? "",
        reswellPackageWidthIn: parcelFill.reswellPackageWidthIn ?? "",
        reswellPackageHeightIn: parcelFill.reswellPackageHeightIn ?? "",
        reswellPackageWeightLb: parcelFill.reswellPackageWeightLb ?? "",
        reswellPackageWeightOz: parcelFill.reswellPackageWeightOz ?? "",
      }
    })
  }, [
    deliveryFlags.shipping_available,
    formData.boardShippingCostMode,
    formData.surfboardShippingTier,
    formData.surfboardShippingPackBand,
  ])

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
   * Auto-pick the smallest UPS-safe shortboard pack (Compact → Standard → Max).
   * Boards over the UPS DIM ceiling cannot use Reswell shipping — turn it off for sellers.
   * Admins may keep flat/free shipping on oversize boards (past inventory, special cases).
   *
   * Wait until `actorIsAdmin` is known — otherwise free/flat gets wiped while the profile
   * query is still in flight (common when editing your own admin listings).
   */
  useEffect(() => {
    if (actorIsAdmin === null && !impersonation) return

    const resolved = resolveSellReswellShipping({
      boardLength: formData.boardLength,
      boardWidthInches: formData.boardWidthInches,
    })
    const allowPrivilegedShippingUi =
      actorIsAdmin === true || Boolean(impersonation)

    setFormData((fd) => {
      const shippingOn = flagsFromBoardFulfillment(fd.boardFulfillment).shipping_available
      const privilegedFlatOrFree =
        allowPrivilegedShippingUi &&
        (fd.boardShippingCostMode === "free" || fd.boardShippingCostMode === "flat")

      if (!resolved.shippingSupported) {
        // Admin flat/free on an oversize board — keep shipping; clear Reswell pack fields only.
        if (privilegedFlatOrFree && shippingOn) {
          if (
            !fd.surfboardShippingTier &&
            !fd.surfboardShippingPackBand &&
            !fd.reswellPackageLengthIn &&
            !fd.reswellPackageWidthIn &&
            !fd.reswellPackageHeightIn &&
            !fd.reswellPackageWeightLb &&
            !fd.reswellPackageWeightOz
          ) {
            return fd
          }
          return {
            ...fd,
            surfboardShippingTier: "" as SurfboardShippingTierId | "",
            surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
            surfboardShippingTierCeilingConfirmed: false,
            surfboardShippingPackBandCeilingConfirmed: false,
            reswellPackageLengthIn: "",
            reswellPackageWidthIn: "",
            reswellPackageHeightIn: "",
            reswellPackageWeightLb: "",
            reswellPackageWeightOz: "",
          }
        }

        // Admin may still enable flat/free — don't yank shipping off while they pick a mode.
        if (allowPrivilegedShippingUi && shippingOn) {
          if (
            !fd.surfboardShippingTier &&
            !fd.surfboardShippingPackBand &&
            fd.boardShippingCostMode !== "reswell"
          ) {
            return fd
          }
          return {
            ...fd,
            // Default oversize admin ship to flat so Save isn't blocked on Reswell UPS checks.
            boardShippingCostMode:
              fd.boardShippingCostMode === "free" || fd.boardShippingCostMode === "flat"
                ? fd.boardShippingCostMode
                : ("flat" as BoardShippingCostMode),
            surfboardShippingTier: "" as SurfboardShippingTierId | "",
            surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
            surfboardShippingTierCeilingConfirmed: false,
            surfboardShippingPackBandCeilingConfirmed: false,
            reswellPackageLengthIn: "",
            reswellPackageWidthIn: "",
            reswellPackageHeightIn: "",
            reswellPackageWeightLb: "",
            reswellPackageWeightOz: "",
          }
        }

        if (!shippingOn && !fd.surfboardShippingTier && !fd.surfboardShippingPackBand) {
          return fd
        }
        const pickupOnly = boardFulfillmentFromChecks(false, true)
        return {
          ...fd,
          boardFulfillment: shippingOn ? pickupOnly : fd.boardFulfillment,
          boardShippingCostMode: "reswell" as BoardShippingCostMode,
          surfboardShippingTier: "" as SurfboardShippingTierId | "",
          surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
          surfboardShippingTierCeilingConfirmed: false,
          surfboardShippingPackBandCeilingConfirmed: false,
          reswellPackageLengthIn: "",
          reswellPackageWidthIn: "",
          reswellPackageHeightIn: "",
          reswellPackageWeightLb: "",
          reswellPackageWeightOz: "",
        }
      }

      if (!shippingOn) return fd

      // Always pick the smallest UPS-safe pack that fits — sellers never choose.
      const nextBand = resolved.suggestedPackBandId
      const nextTier = nextBand ? ("shortboard" as const) : ("" as const)
      const ceilingOk = Boolean(nextBand)

      const keepPrivilegedMode = privilegedFlatOrFree

      if (
        (keepPrivilegedMode || fd.boardShippingCostMode === "reswell") &&
        fd.surfboardShippingTier === nextTier &&
        fd.surfboardShippingPackBand === nextBand &&
        fd.surfboardShippingTierCeilingConfirmed === ceilingOk &&
        fd.surfboardShippingPackBandCeilingConfirmed === ceilingOk
      ) {
        return fd
      }

      return {
        ...fd,
        boardShippingCostMode: keepPrivilegedMode
          ? fd.boardShippingCostMode
          : ("reswell" as BoardShippingCostMode),
        surfboardShippingTier: nextTier,
        surfboardShippingPackBand: nextBand,
        surfboardShippingTierCeilingConfirmed: ceilingOk,
        surfboardShippingPackBandCeilingConfirmed: ceilingOk,
      }
    })
  }, [
    actorIsAdmin,
    impersonation,
    formData.boardLength,
    formData.boardWidthInches,
    deliveryFlags.shipping_available,
  ])

  /**
   * `/sell?new=1` — blank form and local snapshot.
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
  }, [startFresh, supabase])

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

      if (
        !wantsBlankListing &&
        !suppressIdbForNewListing &&
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
    const loadActorAdmin = async (userId: string | null) => {
      if (!userId) {
        setActorIsAdmin(null)
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
      void loadActorAdmin(user?.id ?? null)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null
      sellDraftUserIdRef.current = uid
      setSignedInUserId(uid)
      void loadActorAdmin(uid)
      if (!uid) return
      photoUploadSignInPromptedRef.current = false
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
        await persistSellListingDraftSnapshot({
          listingType: r.listingType,
          formData: r.formData,
          images: r.images,
          userId: sellDraftUserIdRef.current,
        })
      })()
    }, 600)
    return () => {
      if (sellDraftPersistTimerRef.current) clearTimeout(sellDraftPersistTimerRef.current)
    }
  }, [editId, draftHydrated, formData, images])

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
        const authMsg = "Sign in again to upload this photo."
        logSellFunnelEvent({
          listingType: "surfboards",
          event: "upload_failed",
          message: authMsg,
        })
        setImages((prev) =>
          prev.map((s) =>
            s.clientId === clientId
              ? {
                  ...s,
                  optimizePhase: "done",
                  uploadPhase: "error",
                  errorMessage: authMsg,
                }
              : s,
          ),
        )
        if (!photoUploadSignInPromptedRef.current) {
          photoUploadSignInPromptedRef.current = true
          const ret = `/sell${sellSearchParams.toString() ? `?${sellSearchParams}` : ""}`
          toast.error(authMsg)
          openSignIn(ret)
        }
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

  /** After guest Publish → sign-in, resume submit once photos finish uploading. */
  useEffect(() => {
    if (!draftHydrated || editId || pendingPublishHandledRef.current) return
    let cancelled = false

    void (async () => {
      let pending = false
      try {
        pending = sessionStorage.getItem(SELL_PENDING_PUBLISH_KEY) === "1"
      } catch {
        /* ignore */
      }
      if (!pending) return

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      pendingPublishHandledRef.current = true
      try {
        sessionStorage.removeItem(SELL_PENDING_PUBLISH_KEY)
      } catch {
        /* ignore */
      }

      for (let i = 0; i < 120 && !cancelled; i++) {
        const imgs = imagesRef.current
        const workLeft = imgs.some(
          (im) =>
            im.sourceFile &&
            (im.optimizePhase === "running" ||
              im.uploadPhase === "uploading" ||
              (im.optimizePhase === "done" &&
                im.uploadPhase !== "done" &&
                im.uploadPhase !== "error")),
        )
        if (!workLeft) break
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      if (cancelled) return
      window.requestAnimationFrame(() => {
        formRef.current?.requestSubmit()
      })
    })()

    return () => {
      cancelled = true
    }
  }, [draftHydrated, editId, supabase])

  function retryListingPhotoUpload(clientId: string) {
    photoUploadSignInPromptedRef.current = false
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (publishInFlightRef.current) {
      return
    }
    publishInFlightRef.current = true

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
        await persistSellListingDraftSnapshot({
          listingType: "board",
          formData: formData as SellListingDraftFormSnapshot,
          images,
          userId: null,
        })
        try {
          sessionStorage.setItem(SELL_PENDING_PUBLISH_KEY, "1")
        } catch {
          /* quota / private mode */
        }
        const ret = `/sell${sellSearchParams.toString() ? `?${sellSearchParams}` : ""}`
        toast.message("Sign in to publish your listing")
        openSignIn(ret)
        return
      }

      clearImpersonationStorageIfCookieMissing()

      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()
      const submitActorIsAdmin = actorProfile?.is_admin === true
      setActorIsAdmin(submitActorIsAdmin)

      /** Only admins may use impersonation listing APIs; server also requires the HTTP cookie + target id. */
      let storedImpersonation = getImpersonation()
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
      const upsShippingSupported = resolveSellReswellShipping({
        boardLength: submitForm.boardLength,
        boardWidthInches: submitForm.boardWidthInches,
      }).shippingSupported

      // Admin free/flat are separate from Reswell UPS — never validate UPS DIM for those modes.
      // If Reswell isn't available, coerce a leftover "reswell" selection to flat before validate/save.
      let submitFormForSave = submitForm
      if (
        allowPrivilegedShipping &&
        flagsFromBoardFulfillment(submitForm.boardFulfillment).shipping_available &&
        !upsShippingSupported &&
        (submitForm.boardShippingCostMode === "reswell" || !submitForm.boardShippingCostMode)
      ) {
        submitFormForSave = {
          ...submitForm,
          boardShippingCostMode: "flat" as BoardShippingCostMode,
          surfboardShippingTier: "" as SurfboardShippingTierId | "",
          surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
          surfboardShippingTierCeilingConfirmed: false,
          surfboardShippingPackBandCeilingConfirmed: false,
          reswellPackageLengthIn: "",
          reswellPackageWidthIn: "",
          reswellPackageHeightIn: "",
          reswellPackageWeightLb: "",
          reswellPackageWeightOz: "",
        }
        setFormData(submitFormForSave)
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
      })
      uploadToastIdRef.current = toast.loading("Your listing is being uploaded...", {
        duration: 600_000,
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
        const adminImpersonatesListingOwner =
          !!editId &&
          !!listingImpersonation &&
          listingImpersonation.userId === editListingOwnerId &&
          user.id !== editListingOwnerId

        /** Persists surfboard dims on `listings.dimensions` (see migration `20260815120000_listings_dimensions_column.sql`). */
        const dimensionsStored = listingDimensionsColumnFromSurfboardSellForm(fd)
        const packedRow = reswellPackageFieldsToDb(fd)
        const editListingFields = {
          title: resolvedListingTitle,
          description: fd.description,
          price: parseFloat(fd.price),
          condition: fd.condition,
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
          if (updateError) throw new Error(sellSubmitErrorMessage(updateError, "Failed to update listing"))
          listingSlug = updated?.slug ?? null
          listingId = effectiveEditId
          persistBoardCatalogSnapshot(effectiveEditId, user.id)
          if (publishingFromDraftRow) {
            requestKlaviyoListingCreated(effectiveEditId)
            // Search-index / merchant sync runs after images are synced below.
            publishedDraftNeedsSideEffects = true
          }
          clearSellServerDraftListingId("surfboards")
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
          const res = await fetch("/api/admin/impersonate/update-listing", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              listingId: editId,
              listing: editListingFields,
              removedImageIds,
              images: imageOps,
              catalog_snapshot: boardCatalogSnapshotFromSellForm(fd),
              publishFromDraft: listingIsDraft,
            }),
          })
          const data = await res.json()
          if (!res.ok) {
            throw new Error(sellActionErrorMessage(data.error || "Failed to update listing"))
          }
          listingSlug = data.slug
          if (data.published === true) {
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
          requestKlaviyoListingCreated(String(listing.id))
          void applyBoardListingPublishedSideEffectsAction(String(listing.id)).catch((err) => {
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
            void applyBoardListingPublishedSideEffectsAction(listingId).catch((err) => {
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
          retainPublishOverlayUntilNavigation = true
          router.push(detailPath)
          return
        }
        if (editId && !usedImpersonationListingApi) {
          const willSyncNewPhotos = images.some((im) => !im.id && im.url)
          if (willSyncNewPhotos) goSubmitStep(1)
          await syncListingImages(listingId)
          goSubmitStep(2)
        }
        if (publishedDraftNeedsSideEffects) {
          void applyBoardListingPublishedSideEffectsAction(listingId).catch((err) => {
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
          return
        }
      }
      router.push(detailPath)
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

  const stepCount = Math.max(1, uploadPhaseLabels.length)
  const listingSubmitProgressValue = Math.min(
    100,
    Math.round(((submitStepIndex + 1) / stepCount) * 100),
  )

  const optimizingAny = images.some((im) => im.optimizePhase === "running")

  /** Covers publish + rare early loading without preview; never while edit hydration is blocking. */
  const fullscreenSellBlocking = loading && (!!publishPreview || !editLoading)

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
          "flex-1 w-full bg-background",
          !fullscreenSellBlocking && "pt-8 pb-16 md:pb-20 lg:pb-24",
        )}
      >
        <AdminBulkListingBanner section="surfboards" bulkSlotId={bulkSlotId} />
        <div className="container relative mx-auto max-w-2xl min-h-[50vh] lg:max-w-6xl">
          {loading && publishPreview ? (
            <SellFlowPublishingFullscreenPortal
              preview={publishPreview}
              uploadPhaseLabels={uploadPhaseLabels}
              submitStepIndex={submitStepIndex}
              listingSubmitProgressValue={listingSubmitProgressValue}
            />
          ) : loading && !editLoading && !publishPreview ? (
            <SellPublishingGenericLoaderPortal />
          ) : null}
          <div
            className={cn(fullscreenSellBlocking && "hidden")}
            aria-hidden={fullscreenSellBlocking ? true : undefined}
          >
          <h1 className="sr-only">
            {editId ? "Edit listing" : "Create a Listing"}
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
                      <Link href={sellListingsHubHref}>Listings</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-normal text-[#5c6b89]">
                      {editId ? "Edit listing" : "Create a Listing"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3 shrink-0">
                {!editLoading && (!editId || listingIsDraft) && !getImpersonation() && (
                    <div className="flex items-center gap-3">
                      {boardDraftControls}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Exit listing form"
                        asChild
                      >
                        <Link href={sellListingsHubHref}>
                          <X className="h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  )}
              </div>
            </div>
          </div>

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
                      onClick={() =>
                        scrollSellFormSectionIntoView(firstIncompleteSellSectionId)
                      }
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

          {!editLoading && getImpersonation() && listingIsDraft ? (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Seller draft</AlertTitle>
              <AlertDescription>
                You are editing this seller&apos;s draft as admin. Finish any missing fields, then
                use <span className="font-medium">Publish listing</span> to make it live.
              </AlertDescription>
            </Alert>
          ) : null}

          {editLoading ? (
            <div
              role="status"
              aria-label="Loading listing editor"
              className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
            >
              <SellFlowFormColumnSkeleton />
            </div>
          ) : (
            <div className="flex w-full flex-col gap-8 lg:mx-auto lg:w-max lg:max-w-full lg:flex-row lg:items-start lg:gap-10 xl:gap-14">
              <div className="hidden shrink-0 lg:block lg:w-52 xl:w-56">
                <SellSectionNav
                  items={SELL_FORM_SECTION_NAV_ITEMS}
                  sectionCompletion={sellSectionCompletion}
                />
              </div>
              <div className="min-w-0 w-full max-w-2xl lg:w-auto lg:max-w-3xl lg:shrink-0">
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
                  description="Write a title in your own words. It's what buyers see first. Add clear photos of your board."
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
                      Add photos, then drag to reorder — the first is your main image.
                    </p>
                  <Label className="sr-only">Listing photos</Label>
                  <div
                    className={cn(
                      "relative rounded-lg transition-shadow",
                      photosFileDragActive && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    )}
                    onDragEnter={handlePhotosFileDragEnter}
                    onDragLeave={handlePhotosFileDragLeave}
                    onDragOver={handlePhotosFileDragOver}
                    onDrop={handlePhotosFileDrop}
                  >
                  {photosFileDragActive ? (
                    <div
                      className="pointer-events-none absolute inset-0 z-[70] flex items-center justify-center rounded-lg bg-primary/10"
                      aria-hidden
                    >
                      <p className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium text-primary shadow-sm">
                        Drop photos to add
                      </p>
                    </div>
                  ) : null}
                  <DndContext
                    sensors={photoDragSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handlePhotosDragEnd}
                  >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    <SortableContext
                      items={images.map((im) => im.clientId)}
                      strategy={rectSortingStrategy}
                    >
                    {images.map((image, index) => (
                      <SellListingPhotoSortableTile
                        key={image.clientId}
                        image={image}
                        index={index}
                        onRemove={handlePhotoTileRemove}
                        onRetry={handlePhotoTileRetry}
                        onRotate180={handlePhotoTileRotate}
                      />
                    ))}
                    </SortableContext>
                    {images.length < 12 && (
                      <div className="relative aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors overflow-hidden">
                        <div
                          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                          aria-hidden
                        >
                          <Upload className="h-6 w-6 text-muted-foreground/45" />
                          <span className="mt-1 text-xs text-muted-foreground/45">Add</span>
                        </div>
                        <input
                          id={listingPhotosInputId}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageChange}
                          aria-label="Add listing photos"
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 touch-manipulation"
                          onPointerDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>
                  </DndContext>
                  </div>
                  <p className="text-xs text-muted-foreground/45 space-y-1">
                    <span className="block">Thank you for listing on Reswell.</span>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span>Made with</span>
                      <Heart
                        className="h-4 w-4 shrink-0 fill-listingHeart text-listingHeart"
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
                            {!sellCategoriesLoaded ? (
                              <SelectItem value="__loading__" disabled>
                                Loading categories…
                              </SelectItem>
                            ) : boardCategoryOptions.length === 0 ? (
                              <SelectItem value="__empty__" disabled>
                                No board categories found — add rows with board = true in public.categories.
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
                              <Label htmlFor="listing-brand">Brand</Label>
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
                              boardBrandModelId: "",
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
                            "Brand and model are saved on your listing and power search and filters. Requesting a missing brand or model still goes through the separate request queue for our catalog team."
                          }
                        </p>
                      </div>

                      <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {/* Length */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground/45">Length</Label>
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
                              )}
                            >
                              <Input
                                ref={boardDimWidthRef}
                                type="text"
                                inputMode="text"
                                placeholder="19 1/4"
                                value={formData.boardWidthInches}
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
                              )}
                            >
                              <Input
                                ref={boardDimThicknessRef}
                                type="text"
                                inputMode="text"
                                placeholder="2 3/8"
                                value={formData.boardThicknessInches}
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
                              )}
                            >
                              <Input
                                ref={boardDimVolumeRef}
                                type="text"
                                inputMode="text"
                                placeholder="30.4"
                                value={formData.boardVolumeL}
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

                      <SellBoardFacetFields
                        boardFins={formData.boardFins}
                        boardFinSystem={formData.boardFinSystem}
                        boardConstruction={formData.boardConstruction}
                        onBoardFinsChange={(value) =>
                          setFormData((fd) => ({ ...fd, boardFins: value }))
                        }
                        onBoardFinSystemChange={(value) =>
                          setFormData((fd) => ({ ...fd, boardFinSystem: value }))
                        }
                        onBoardConstructionChange={(value) =>
                          setFormData((fd) => ({ ...fd, boardConstruction: value }))
                        }
                        disabled={editLoading}
                      />

                      <p className="text-xs text-muted-foreground/45 pt-0.5">
                        Dimensions are optional. When you fill them in, surfers can compare your board more
                        confidently—often that helps listings move faster.
                      </p>
                    </div>
                      </div>

                    <Separator className="bg-border" />

                    <div className="space-y-6">
                <SellListingDescriptionField
                  id="description"
                  value={formData.description}
                  onChange={(description) => setFormData({ ...formData, description })}
                  placeholder="Describe your board…"
                  maxLength={1000}
                />
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
                              disabled={
                                Boolean(formData.boardLength.trim()) &&
                                !sellReswellShipping.shippingSupported &&
                                actorIsAdmin === false &&
                                !impersonation
                              }
                              onCheckedChange={(v) => {
                                const want = v === true
                                const allowPrivilegedShippingUi =
                                  actorIsAdmin === true || Boolean(impersonation)
                                // Only hard-block sellers (admin resolved false). While admin
                                // status is loading (null), allow the toggle.
                                if (
                                  want &&
                                  formData.boardLength.trim() &&
                                  !sellReswellShipping.shippingSupported &&
                                  actorIsAdmin === false &&
                                  !impersonation
                                ) {
                                  return
                                }
                                const cur = flagsFromBoardFulfillment(formData.boardFulfillment)
                                let ns = want
                                let np = cur.local_pickup
                                if (!ns && !np) np = true
                                const oversizeAdminShip =
                                  want &&
                                  allowPrivilegedShippingUi &&
                                  Boolean(formData.boardLength.trim()) &&
                                  !sellReswellShipping.shippingSupported
                                setFormData({
                                  ...formData,
                                  boardFulfillment: boardFulfillmentFromChecks(ns, np),
                                  ...(want
                                    ? {
                                        // Oversize: default to flat (other carrier), not Reswell UPS.
                                        boardShippingCostMode: oversizeAdminShip
                                          ? ("flat" as BoardShippingCostMode)
                                          : ("reswell" as BoardShippingCostMode),
                                        ...(oversizeAdminShip
                                          ? {
                                              surfboardShippingTier: "" as SurfboardShippingTierId | "",
                                              surfboardShippingTierCeilingConfirmed: false,
                                              surfboardShippingPackBand:
                                                "" as SurfboardShippingPackBandId | "",
                                              surfboardShippingPackBandCeilingConfirmed: false,
                                              reswellPackageLengthIn: "",
                                              reswellPackageWidthIn: "",
                                              reswellPackageHeightIn: "",
                                              reswellPackageWeightLb: "",
                                              reswellPackageWeightOz: "",
                                            }
                                          : {}),
                                      }
                                    : {
                                        boardShippingCostMode: "reswell" as BoardShippingCostMode,
                                        boardShippingPrice: "",
                                        surfboardShippingTier: "" as SurfboardShippingTierId | "",
                                        surfboardShippingTierCeilingConfirmed: false,
                                        surfboardShippingPackBand: "" as SurfboardShippingPackBandId | "",
                                        surfboardShippingPackBandCeilingConfirmed: false,
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
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="space-y-1">
                                <Label
                                  htmlFor="sell-delivery-shipping"
                                  className={cn(
                                    "text-sm font-medium leading-snug flex flex-wrap items-center gap-2",
                                    formData.boardLength.trim() &&
                                      !sellReswellShipping.shippingSupported &&
                                      actorIsAdmin === false &&
                                      !impersonation
                                      ? "cursor-not-allowed text-muted-foreground"
                                      : "cursor-pointer",
                                  )}
                                >
                                  {actorIsAdmin === true || Boolean(impersonation) ? (
                                    <span>Offer shipping to buyers</span>
                                  ) : (
                                    <span>
                                      Reswell shipping{" "}
                                      <span className="font-bold uppercase tracking-wide text-foreground">
                                        (BUYER PAYS SHIPPING)
                                      </span>
                                    </span>
                                  )}
                                  {!(actorIsAdmin === true || Boolean(impersonation)) ? (
                                    <Badge
                                      variant="default"
                                      className="border-0 bg-listingHeart text-white font-bold uppercase tracking-wide text-[10px] px-2 py-0.5 h-auto hover:bg-[#2a4170]"
                                    >
                                      Recommended to sell your board faster
                                    </Badge>
                                  ) : null}
                                </Label>
                                {deliveryFlags.shipping_available &&
                                !(actorIsAdmin === true || Boolean(impersonation)) ? (
                                  <p className="text-sm text-muted-foreground/45 leading-relaxed">
                                    Buyer pays for shipping at checkout. We handle the calculations
                                    for you so you don&apos;t have to worry about shipping cost —
                                    we&apos;ll email you the label after the sale.
                                  </p>
                                ) : null}
                                {formData.boardLength.trim() &&
                                !sellReswellShipping.shippingSupported &&
                                actorIsAdmin === false &&
                                !impersonation ? (
                                  <p className="text-sm text-destructive leading-relaxed">
                                    Reswell UPS shipping isn&apos;t available for this board — it
                                    exceeds size limits. Use local pickup.
                                  </p>
                                ) : null}
                                {deliveryFlags.shipping_available &&
                                (actorIsAdmin === true || Boolean(impersonation)) ? (
                                  <div className="space-y-2 pt-1">
                                    <p className="text-sm text-muted-foreground/45 leading-relaxed">
                                      Choose how shipping is priced. Reswell uses UPS labels; free and
                                      flat-rate are separate — you fulfill with any carrier.
                                    </p>
                                    <SellShippingCostModeRadios
                                      idPrefix="sell-surfboard"
                                      value={formData.boardShippingCostMode}
                                      reswellAvailable={sellReswellShipping.shippingSupported}
                                      onChange={(mode) => {
                                        const clearReswellPack =
                                          mode === "free" || mode === "flat"
                                        setFormData({
                                          ...formData,
                                          boardShippingCostMode: mode,
                                          ...(mode !== "flat" ? { boardShippingPrice: "" } : {}),
                                          ...(clearReswellPack
                                            ? {
                                                surfboardShippingTier:
                                                  "" as SurfboardShippingTierId | "",
                                                surfboardShippingTierCeilingConfirmed: false,
                                                surfboardShippingPackBand:
                                                  "" as SurfboardShippingPackBandId | "",
                                                surfboardShippingPackBandCeilingConfirmed: false,
                                                reswellPackageLengthIn: "",
                                                reswellPackageWidthIn: "",
                                                reswellPackageHeightIn: "",
                                                reswellPackageWeightLb: "",
                                                reswellPackageWeightOz: "",
                                              }
                                            : {}),
                                        })
                                      }}
                                      allowPrivilegedModes
                                      flatRateSlot={
                                        <div className="space-y-2 rounded-lg border border-border bg-background p-4 sm:p-5">
                                          <Label
                                            htmlFor="sell-surfboard-shipping-price"
                                            className="text-sm font-semibold text-foreground"
                                          >
                                            Flat shipping rate{" "}
                                            <span className="text-destructive" aria-hidden>
                                              *
                                            </span>
                                          </Label>
                                          <div className="relative max-w-md">
                                            <span
                                              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground/45"
                                              aria-hidden
                                            >
                                              $
                                            </span>
                                            <Input
                                              id="sell-surfboard-shipping-price"
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
                                        </div>
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
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
                                // Too-large boards cannot use Reswell shipping — keep pickup on
                                // for sellers only (admin free/flat uses another carrier).
                                if (
                                  !np &&
                                  formData.boardLength.trim() &&
                                  !sellReswellShipping.shippingSupported &&
                                  actorIsAdmin === false &&
                                  !impersonation
                                ) {
                                  np = true
                                  ns = false
                                }
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

                    </div>
                  </div>
                </SellFormSection>

                <SellFormSection
                  sectionId="sell-section-publish"
                  title={editId ? "Price & listing" : "Price & publish your listing"}
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
                            <p className="text-sm text-muted-foreground/45 leading-relaxed">
                              Lets you negotiate a final price with buyers before checkout.
                            </p>
                          </div>
                        </div>
                      </div>
                    }
                  />
                  <Separator />
                {publishPreview && !loading && (
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

                {!loading ? (
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full relative transition-shadow"
                  >
                    {editId ? (listingIsDraft ? "Publish listing" : "Save changes") : "Create Listing"}
                  </Button>
                ) : null}
                </div>
                </SellFormSection>
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
}) {
  return <SellSearchParamsBridge {...props} />
}

/** Reads URL params — avoids wrapping the shell in Suspense */
function SellSearchParamsBridge(props: {
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
    />
  )
}
