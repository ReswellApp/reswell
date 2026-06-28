"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { Heart, Loader2, Upload, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { LocationPicker } from "@/components/location-picker"
import { SellFormSection } from "@/components/features/sell/sell-form-section"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { SellBoardbagsFacetFields } from "@/components/features/sell/sell-boardbags-facet-fields"
import { SellPriceFields } from "@/components/features/sell/sell-price-fields"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import {
  SellSectionNav,
  SellSectionNavHorizontal,
  buildSellSectionNavItems,
} from "@/components/features/sell/sell-section-nav"
import { createClient } from "@/lib/supabase/client"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import {
  assertListingOriginalSize,
  prepareListingImagePairFromFile,
} from "@/lib/listing-image-pipeline"
import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import { friendlyListingPhotoErrorMessage } from "@/lib/utils/friendly-listing-photo-error"
import { uploadListingImagePairToSupabase } from "@/lib/listing-image-storage"
import {
  BOARDBAG_LISTING_MAX_PHOTOS,
  BOARDBAG_LISTING_TITLE_MAX_LENGTH,
  type CreateBoardbagListingInput,
} from "@/lib/validations/boardbag-listing"
import {
  createBoardbagListingAction,
  updateBoardbagListingAction,
} from "@/lib/actions/boardbagListingActions"
import { buildBoardbagListingPersistFields } from "@/lib/boardbag-listing-persist-fields"
import { computeBoardbagSellSectionCompletion } from "@/lib/boardbag-sell-section-completion"
import { sellFormConditionValue } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import {
  clearImpersonation,
  clearImpersonationStorageIfCookieMissing,
  getImpersonation,
} from "@/lib/impersonation"
import { reswellPackageFormFromDbRow } from "@/lib/sell-listing-fulfillment-flags"
import {
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
} from "@/lib/board-measurements"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"
import { cn } from "@/lib/utils"
import { AdminBulkListingBanner } from "@/components/features/sell/admin-bulk-listing-banner"
import { finalizePeerListingCreate } from "@/lib/utils/admin-peer-listing-create-navigation"

const SELL_BOARDBAGS_FORM_SECTION_NAV_ITEMS = buildSellSectionNavItems("boardbags", "Boardbag details")

type PhotoPhase = "optimizing" | "uploading" | "done" | "error"

type PhotoSlot = {
  clientId: string
  previewUrl: string
  file?: File
  imageId?: string
  url?: string
  thumbnailUrl?: string
  phase: PhotoPhase
  progress: number
}

function shippingPriceToFormValue(v: unknown): string {
  if (v == null || v === "") return ""
  const n = Number.parseFloat(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? String(n) : ""
}

function boardbagShippingModeFromListing(listing: {
  shipping_available?: boolean | null
  shipping_price?: number | string | null
  board_shipping_cost_mode?: string | null
}): BoardbagFormState["shippingMode"] {
  const stored = listing.board_shipping_cost_mode
  if (stored === "reswell" || stored === "free" || stored === "flat") return stored
  if (listing.shipping_available) {
    const n = Number.parseFloat(String(listing.shipping_price ?? 0).replace(/,/g, ""))
    if (Number.isFinite(n) && n > 0) return "flat"
    return "free"
  }
  return "reswell"
}

type BoardbagFormState = {
  title: string
  description: string
  price: string
  sellerPurchasePrice: string
  condition: string
  size: string
  brand: string
  model: string
  locationCity: string
  locationState: string
  locationLat: number | null
  locationLng: number | null
  locationDisplay: string
  shippingAvailable: boolean
  localPickup: boolean
  shippingMode: "reswell" | "free" | "flat"
  shippingPrice: string
  reswellPackageLengthIn: string
  reswellPackageWidthIn: string
  reswellPackageHeightIn: string
  reswellPackageWeightLb: string
  reswellPackageWeightOz: string
  buyerOffers: boolean
}

const INITIAL_STATE: BoardbagFormState = {
  title: "",
  description: "",
  price: "",
  sellerPurchasePrice: "",
  condition: "",
  size: "",
  brand: "",
  model: "",
  locationCity: "",
  locationState: "",
  locationLat: null,
  locationLng: null,
  locationDisplay: "",
  shippingAvailable: false,
  localPickup: true,
  shippingMode: "reswell",
  shippingPrice: "",
  reswellPackageLengthIn: "",
  reswellPackageWidthIn: "",
  reswellPackageHeightIn: "",
  reswellPackageWeightLb: "",
  reswellPackageWeightOz: "",
  buyerOffers: true,
}

function newClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function scrollBoardbagSellSectionIntoView(sectionId: string) {
  const el = document.getElementById(sectionId)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export default function SellBoardbagsFlow({ editListingId = null }: { editListingId?: string | null }) {
  const router = useRouter()
  const bulkSlotId = useSearchParams().get("bulk")?.trim() || null
  const signIn = useSignInGate()
  const fileInputId = useId()
  const supabaseRef = useRef(createClient())
  const editId = editListingId?.trim() || null

  const [form, setForm] = useState<BoardbagFormState>(INITIAL_STATE)
  const [photos, setPhotos] = useState<PhotoSlot[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [editLoading, setEditLoading] = useState(Boolean(editId))
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])

  const photosRef = useRef<PhotoSlot[]>([])
  photosRef.current = photos

  useEffect(() => {
    return () => {
      for (const p of photosRef.current) {
        if (p.file) URL.revokeObjectURL(p.previewUrl)
      }
    }
  }, [])

  useEffect(() => {
    if (!editId) {
      setEditLoading(false)
      return
    }

    let mounted = true
    setEditLoading(true)

    void (async () => {
      const supabase = supabaseRef.current
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) {
          setEditLoading(false)
          signIn(`/sell/boardbags?edit=${editId}`)
        }
        return
      }

      const imp = getImpersonation()
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
        router.replace("/sell/boardbags", { scroll: false })
        setEditLoading(false)
        return
      }

      if ((listing as { status?: string }).status === "sold") {
        toast.message("This listing has sold — it can't be edited.")
        router.replace(
          listingDetailHref({
            id: String(listing.id),
            slug: (listing as { slug?: string | null }).slug ?? null,
          }),
        )
        setEditLoading(false)
        return
      }

      if ((listing as { section?: string }).section !== "boardbags") {
        toast.error("Only boardbag listings can be edited here.")
        router.replace("/sell/boardbags", { scroll: false })
        setEditLoading(false)
        return
      }

      setEditListingOwnerId(listing.user_id as string)
      if (imp && imp.userId !== listing.user_id) {
        clearImpersonation()
      }

      const loadedReswellPackage = reswellPackageFormFromDbRow(
        listing as {
          shipping_packed_length_in?: number | string | null
          shipping_packed_width_in?: number | string | null
          shipping_packed_height_in?: number | string | null
          shipping_packed_weight_oz?: number | string | null
        },
      )
      const shippingMode = boardbagShippingModeFromListing(
        listing as {
          shipping_available?: boolean | null
          shipping_price?: number | string | null
          board_shipping_cost_mode?: string | null
        },
      )

      setForm({
        title: listing.title ?? "",
        description: listing.description ?? "",
        price: String(listing.price ?? ""),
        sellerPurchasePrice: (() => {
          const v = (listing as { seller_purchase_price_usd?: number | string | null })
            .seller_purchase_price_usd
          if (v == null || v === "") return ""
          return String(v)
        })(),
        condition: sellFormConditionValue(listing.condition),
        size: (listing as { boardbag_size?: string | null }).boardbag_size ?? "",
        brand: (listing as { brand?: string | null }).brand?.trim() ?? "",
        model: (listing as { model?: string | null }).model?.trim() ?? "",
        locationCity: listing.city ?? "",
        locationState: listing.state ?? "",
        locationLat: listing.latitude != null ? Number(listing.latitude) : null,
        locationLng: listing.longitude != null ? Number(listing.longitude) : null,
        locationDisplay: [listing.city, listing.state].filter(Boolean).join(", "),
        shippingAvailable: Boolean(listing.shipping_available),
        localPickup: listing.local_pickup !== false,
        shippingMode,
        shippingPrice: shippingPriceToFormValue(listing.shipping_price),
        ...loadedReswellPackage,
        buyerOffers:
          (listing as { buyer_offers_enabled?: boolean | null }).buyer_offers_enabled !== false,
      })

      const existingImages = ((listing.listing_images as Array<{
        id: string
        url: string
        thumbnail_url: string | null
        is_primary: boolean | null
        sort_order: number | null
      }> | null) ?? [])
        .slice()
        .sort(
          (a, b) =>
            (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
            (a.sort_order ?? 0) - (b.sort_order ?? 0),
        )
        .map((img) => {
          const url = img.url
          const thumb = img.thumbnail_url?.trim() || url
          return {
            clientId: img.id,
            imageId: img.id,
            previewUrl: proxiedListingImageSrc(thumb) ?? thumb,
            url,
            thumbnailUrl: thumb,
            phase: "done" as const,
            progress: 100,
          }
        })

      setPhotos(existingImages)
      setRemovedImageIds([])
      setEditLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [editId, router, signIn])

  const setField = useCallback(<K extends keyof BoardbagFormState>(key: K, value: BoardbagFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateSlot = useCallback((clientId: string, patch: Partial<PhotoSlot>) => {
    setPhotos((prev) => prev.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p)))
  }, [])

  const uploadSlot = useCallback(
    async (slot: PhotoSlot) => {
      if (!slot.file) return
      try {
        const decodable = await ensureBrowserDecodableImageFile(slot.file)
        const prepared = await prepareListingImagePairFromFile(decodable)
        updateSlot(slot.clientId, { phase: "uploading", progress: 5 })

        const supabase = supabaseRef.current
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!session?.access_token || !user) {
          updateSlot(slot.clientId, { phase: "error" })
          signIn("/sell/boardbags")
          return
        }

        const { fullUrl, thumbUrl } = await uploadListingImagePairToSupabase({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          accessToken: session.access_token,
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          userId: user.id,
          clientId: slot.clientId,
          prepared,
          onProgressFull: (loaded, total) =>
            updateSlot(slot.clientId, {
              progress: total > 0 ? Math.round((loaded / total) * 100) : 50,
            }),
        })

        updateSlot(slot.clientId, {
          phase: "done",
          progress: 100,
          url: fullUrl,
          thumbnailUrl: thumbUrl,
        })
      } catch (err) {
        console.error("boardbag photo upload failed", err)
        updateSlot(slot.clientId, { phase: "error" })
        toast.error(friendlyListingPhotoErrorMessage(err, "upload"))
      }
    },
    [signIn, updateSlot],
  )

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"))
      if (list.length === 0) return

      const remaining = BOARDBAG_LISTING_MAX_PHOTOS - photosRef.current.length
      if (remaining <= 0) {
        toast.error(`You can add up to ${BOARDBAG_LISTING_MAX_PHOTOS} photos.`)
        return
      }

      const accepted: PhotoSlot[] = []
      for (const file of list.slice(0, remaining)) {
        try {
          assertListingOriginalSize(file)
        } catch (e) {
          toast.error(friendlyListingPhotoErrorMessage(e))
          continue
        }
        accepted.push({
          clientId: newClientId(),
          previewUrl: URL.createObjectURL(file),
          file,
          phase: "optimizing",
          progress: 0,
        })
      }
      if (accepted.length === 0) return
      setPhotos((prev) => [...prev, ...accepted])
      for (const slot of accepted) void uploadSlot(slot)
    },
    [uploadSlot],
  )

  const removePhoto = useCallback((clientId: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.clientId === clientId)
      if (target?.imageId) {
        setRemovedImageIds((ids) =>
          ids.includes(target.imageId!) ? ids : [...ids, target.imageId!],
        )
      }
      if (target?.file) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.clientId !== clientId)
    })
  }, [])

  const makePrimary = useCallback((clientId: string) => {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.clientId === clientId)
      if (idx <= 0) return prev
      const next = [...prev]
      const [picked] = next.splice(idx, 1)
      next.unshift(picked)
      return next
    })
  }, [])

  const uploadingCount = photos.filter((p) => p.phase !== "done" && p.phase !== "error").length
  const readyPhotos = photos.filter((p) => p.phase === "done" && p.url)

  const sellSectionCompletion = useMemo(
    () =>
      computeBoardbagSellSectionCompletion({
        title: form.title,
        readyPhotoCount: readyPhotos.length,
        condition: form.condition,
        description: form.description,
        locationCity: form.locationCity,
        locationState: form.locationState,
        shippingAvailable: form.shippingAvailable,
        localPickup: form.localPickup,
        shippingMode: form.shippingMode,
        shippingPrice: form.shippingPrice,
        reswellPackageLengthIn: form.reswellPackageLengthIn,
        reswellPackageWidthIn: form.reswellPackageWidthIn,
        reswellPackageHeightIn: form.reswellPackageHeightIn,
        reswellPackageWeightLb: form.reswellPackageWeightLb,
        reswellPackageWeightOz: form.reswellPackageWeightOz,
        price: form.price,
      }),
    [form, readyPhotos.length],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      signIn("/sell/boardbags")
      return
    }

    if (readyPhotos.length === 0) {
      toast.error("Add at least one photo.")
      scrollBoardbagSellSectionIntoView("sell-boardbags-section-photos-title")
      return
    }
    if (uploadingCount > 0) {
      toast.error("Hang tight — your photos are still uploading.")
      return
    }
    if (!form.title.trim()) {
      toast.error("Add a title.")
      scrollBoardbagSellSectionIntoView("sell-boardbags-section-photos-title")
      return
    }
    if (!form.condition) {
      toast.error("Choose a condition.")
      scrollBoardbagSellSectionIntoView("sell-boardbags-section-details")
      return
    }
    if (!form.description.trim()) {
      toast.error("Add a description.")
      scrollBoardbagSellSectionIntoView("sell-boardbags-section-details")
      return
    }
    if (!form.price.trim() || Number(form.price) <= 0) {
      toast.error("Enter a price.")
      scrollBoardbagSellSectionIntoView("sell-boardbags-section-publish")
      return
    }
    if (!form.locationCity.trim() || !form.locationState.trim()) {
      toast.error("Confirm where you're listing from.")
      scrollBoardbagSellSectionIntoView("sell-boardbags-section-delivery")
      return
    }
    if (!form.shippingAvailable && !form.localPickup) {
      toast.error("Choose shipping, local pickup, or both.")
      scrollBoardbagSellSectionIntoView("sell-boardbags-section-delivery")
      return
    }
    if (form.shippingAvailable && form.shippingMode === "reswell") {
      const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
      const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
      const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
      if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) {
        toast.error("Enter packed box dimensions for Reswell shipping.")
        scrollBoardbagSellSectionIntoView("sell-boardbags-section-reswell-package")
        return
      }
    }
    if (
      form.shippingAvailable &&
      form.shippingMode === "flat" &&
      (form.shippingPrice === "" || Number(form.shippingPrice) < 0)
    ) {
      toast.error("Enter a flat shipping rate.")
      scrollBoardbagSellSectionIntoView("sell-boardbags-section-delivery")
      return
    }

    const payload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      condition: form.condition as CreateBoardbagListingInput["condition"],
      size: form.size || null,
      brand: form.brand,
      model: form.model,
      locationCity: form.locationCity,
      locationState: form.locationState,
      locationLat: form.locationLat ?? undefined,
      locationLng: form.locationLng ?? undefined,
      shippingAvailable: form.shippingAvailable,
      localPickup: form.localPickup,
      shippingCostMode: form.shippingAvailable ? form.shippingMode : null,
      shippingPrice:
        form.shippingAvailable && form.shippingMode === "flat"
          ? Number(form.shippingPrice || 0)
          : null,
      reswellPackageLengthIn: form.reswellPackageLengthIn,
      reswellPackageWidthIn: form.reswellPackageWidthIn,
      reswellPackageHeightIn: form.reswellPackageHeightIn,
      reswellPackageWeightLb: form.reswellPackageWeightLb,
      reswellPackageWeightOz: form.reswellPackageWeightOz,
      buyerOffers: form.buyerOffers,
      sellerPurchasePrice: form.sellerPurchasePrice ? Number(form.sellerPurchasePrice) : null,
      images: readyPhotos.map((p, index) => ({
        id: p.imageId,
        url: p.url!,
        thumbnailUrl: p.thumbnailUrl ?? null,
        isPrimary: index === 0,
        sortOrder: index,
      })),
    }

    setSubmitting(true)
    try {
      clearImpersonationStorageIfCookieMissing()

      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()
      const actorIsAdmin = actorProfile?.is_admin === true

      let storedImpersonation = getImpersonation()
      if (storedImpersonation && !actorIsAdmin) {
        clearImpersonation()
        storedImpersonation = null
      }
      const listingImpersonation =
        actorIsAdmin && storedImpersonation ? storedImpersonation : null

      const adminImpersonatesListingOwner = Boolean(
        editId &&
          editListingOwnerId &&
          listingImpersonation &&
          listingImpersonation.userId === editListingOwnerId &&
          user.id !== editListingOwnerId,
      )

      if (editId) {
        const ownerEditsOwnListing = user.id === editListingOwnerId
        if (adminImpersonatesListingOwner) {
          const imageOps = payload.images.map((img, index) => ({
            id: img.id,
            url: img.url,
            thumbnail_url: img.thumbnailUrl,
            is_primary: index === 0,
            sort_order: index,
          }))
          const res = await fetch("/api/admin/impersonate/update-listing", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              listingId: editId,
              listing: buildBoardbagListingPersistFields(payload),
              removedImageIds,
              images: imageOps,
            }),
          })
          const data = (await res.json().catch(() => ({}))) as { error?: string; slug?: string }
          if (!res.ok) {
            toast.error(typeof data.error === "string" ? data.error : "Failed to update listing")
            setSubmitting(false)
            return
          }
          toast.success("Listing updated")
          router.push(`/l/${data.slug ?? editId}`)
          return
        }

        if (!ownerEditsOwnListing) {
          toast.error(
            "This listing belongs to another account. From admin, open the seller and use impersonation for that shop, or sign in as the listing owner.",
          )
          setSubmitting(false)
          return
        }

        const result = await updateBoardbagListingAction({
          ...payload,
          listingId: editId,
          removedImageIds,
        })
        if ("error" in result) {
          toast.error(result.error)
          setSubmitting(false)
          return
        }
        toast.success("Listing updated")
        router.push(`/l/${result.slug}`)
        return
      }

      await finalizePeerListingCreate({
        listingImpersonation,
        listingFields: buildBoardbagListingPersistFields(payload),
        images: payload.images.map((img) => ({
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
        })),
        title: payload.title,
        section: "boardbags",
        bulkSlotId,
        router,
        successToast: "Your boardbag is live!",
        setSubmitting,
        directCreate: () => createBoardbagListingAction(payload),
      })
    } catch (err) {
      console.error("boardbag listing submit failed", err)
      toast.error(editId ? "Something went wrong saving your listing." : "Something went wrong publishing your listing.")
      setSubmitting(false)
    }
  }

  if (editLoading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-background py-24">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading listing…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 w-full bg-background pt-8 pb-16 md:pb-20 lg:pb-24">
      <AdminBulkListingBanner section="boardbags" bulkSlotId={bulkSlotId} />
      <div className="container relative mx-auto max-w-2xl min-h-[50vh] lg:max-w-6xl">
        <h1 className="sr-only">{editId ? "Edit boardbag listing" : "List your boardbag"}</h1>

        <div className="mb-6 border-t border-neutral-200 pt-4 pb-8">
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
                    <Link href="/sell">Sell</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-normal text-[#5c6b89]">
                    {editId ? "Edit boardbag listing" : "List boardbag"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button type="button" variant="ghost" size="icon" aria-label="Exit listing form" asChild>
              <Link href="/sell">
                <X className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex w-full flex-col gap-8 lg:mx-auto lg:w-max lg:max-w-full lg:flex-row lg:items-start lg:gap-10 xl:gap-14">
          <div className="hidden shrink-0 lg:block lg:w-52 xl:w-56">
            <SellSectionNav
              items={SELL_BOARDBAGS_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
            />
          </div>

          <div className="min-w-0 w-full max-w-2xl lg:w-auto lg:max-w-3xl lg:shrink-0">
            <SellSectionNavHorizontal
              items={SELL_BOARDBAGS_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
              className="mb-8 hidden md:block lg:hidden"
            />

            <form onSubmit={handleSubmit} className="space-y-10 lg:space-y-12" aria-busy={submitting}>
              <SellFormSection
                sectionId="sell-boardbags-section-photos-title"
                title="Title & photos"
                description="Write a title in your own words. It's what buyers see first. Add clear photos of your boardbag."
              >
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-2">
                      <Label htmlFor="boardbag-title">Title *</Label>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          form.title.length > BOARDBAG_LISTING_TITLE_MAX_LENGTH
                            ? "font-medium text-destructive"
                            : "text-muted-foreground/45",
                        )}
                        aria-live="polite"
                      >
                        {form.title.length}/{BOARDBAG_LISTING_TITLE_MAX_LENGTH}
                      </span>
                    </div>
                    <Input
                      id="boardbag-title"
                      className="placeholder:text-muted-foreground/45"
                      placeholder="e.g. Rip Curl Flashbomb 3/2 Steamer — Medium"
                      value={form.title}
                      maxLength={BOARDBAG_LISTING_TITLE_MAX_LENGTH}
                      onChange={(e) => setField("title", e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>

                  <Separator className="bg-border" />

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Photos</h3>
                    <p className="text-xs text-muted-foreground/45">
                      Add clear photos. The first image is your main photo — tap the star on any
                      other photo to make it the cover.
                    </p>
                    <Label className="sr-only">Listing photos</Label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {photos.map((photo, index) => (
                        <div
                          key={photo.clientId}
                          className="relative aspect-square overflow-hidden rounded-lg border border-transparent bg-muted"
                        >
                          <Image
                            src={photo.previewUrl}
                            alt={`Photo ${index + 1}`}
                            fill
                            sizes="120px"
                            className="object-cover object-center"
                            unoptimized
                          />
                          {photo.phase !== "done" ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 text-xs text-muted-foreground">
                              {photo.phase === "error" ? (
                                <span className="text-destructive">Failed</span>
                              ) : (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  {photo.progress > 0 ? `${photo.progress}%` : null}
                                </>
                              )}
                            </div>
                          ) : null}
                          {index === 0 ? (
                            <span className="absolute left-1.5 top-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                              Main
                            </span>
                          ) : null}
                          <div className="absolute right-1 top-1 flex gap-1">
                            {index !== 0 && photo.phase === "done" ? (
                              <button
                                type="button"
                                onClick={() => makePrimary(photo.clientId)}
                                className="rounded-full bg-background/90 p-1 text-foreground shadow-sm hover:bg-background"
                                title="Make main photo"
                                aria-label="Make main photo"
                              >
                                ★
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removePhoto(photo.clientId)}
                              className="rounded-full bg-background/90 p-1 text-foreground shadow-sm hover:bg-background"
                              title="Remove photo"
                              aria-label="Remove photo"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {photos.length < BOARDBAG_LISTING_MAX_PHOTOS ? (
                        <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary/50">
                          <label
                            htmlFor={fileInputId}
                            className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center"
                          >
                            <span className="sr-only">Add listing photos</span>
                            <Upload
                              className="pointer-events-none h-6 w-6 text-muted-foreground/45"
                              aria-hidden
                            />
                            <span
                              className="pointer-events-none mt-1 text-xs text-muted-foreground/45"
                              aria-hidden
                            >
                              Add
                            </span>
                          </label>
                          <input
                            id={fileInputId}
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={(e) => {
                              if (e.target.files) addFiles(e.target.files)
                              e.target.value = ""
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <p className="space-y-1 text-xs text-muted-foreground/45">
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
                sectionId="sell-boardbags-section-details"
                title="Boardbag details & description"
                description="Condition and details help buyers shop with confidence."
              >
                <div className="space-y-8">
                  <SellBoardbagsFacetFields
                    condition={form.condition}
                    size={form.size}
                    brand={form.brand}
                    model={form.model}
                    onConditionChange={(v) => setField("condition", v)}
                    onSizeChange={(v) => setField("size", v)}
                    onBrandChange={(v) => setField("brand", v)}
                    onModelChange={(v) => setField("model", v)}
                  />

                  <Separator className="bg-border" />

                  <SellListingDescriptionField
                    id="boardbag-description"
                    value={form.description}
                    onChange={(v) => setField("description", v)}
                    placeholder="Thickness, seams, any wear or repairs, why you're selling…"
                  />
                </div>
              </SellFormSection>

              <SellFormSection
                sectionId="sell-boardbags-section-delivery"
                title="Pickup & shipping"
                description="Pin where the boardbag is and choose delivery options."
              >
                <div className="space-y-8">
                  <LocationPicker
                    initialLat={form.locationLat ?? undefined}
                    initialLng={form.locationLng ?? undefined}
                    initialCity={form.locationCity}
                    initialState={form.locationState}
                    initialDisplay={form.locationDisplay}
                    onLocationSelect={(loc) => {
                      setForm((prev) => ({
                        ...prev,
                        locationLat: loc.lat,
                        locationLng: loc.lng,
                        locationCity: loc.city,
                        locationState: loc.state,
                        locationDisplay: loc.displayName,
                      }))
                    }}
                    onLocationClear={() => {
                      setForm((prev) => ({
                        ...prev,
                        locationLat: null,
                        locationLng: null,
                        locationCity: "",
                        locationState: "",
                        locationDisplay: "",
                      }))
                    }}
                  />

                  <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Delivery options{" "}
                        <span className="text-destructive" aria-hidden>
                          *
                        </span>
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground/45">You can select both options.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="sell-boardbags-delivery-shipping"
                          checked={form.shippingAvailable}
                          onCheckedChange={(v) => {
                            const want = v === true
                            setForm((prev) => ({
                              ...prev,
                              shippingAvailable: want,
                              localPickup: want || prev.localPickup ? prev.localPickup : true,
                              ...(want
                                ? {}
                                : {
                                    shippingMode: "reswell" as const,
                                    shippingPrice: "",
                                    reswellPackageLengthIn: "",
                                    reswellPackageWidthIn: "",
                                    reswellPackageHeightIn: "",
                                    reswellPackageWeightLb: "",
                                    reswellPackageWeightOz: "",
                                  }),
                            }))
                          }}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <Label
                            htmlFor="sell-boardbags-delivery-shipping"
                            className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium leading-snug"
                          >
                            Shipping
                            <Badge
                              variant="default"
                              className="h-auto border-0 bg-listingHeart px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#2a4170]"
                            >
                              Items sell faster
                            </Badge>
                          </Label>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="sell-boardbags-delivery-pickup"
                          checked={form.localPickup}
                          onCheckedChange={(v) => {
                            const want = v === true
                            setForm((prev) => ({
                              ...prev,
                              localPickup: want,
                              shippingAvailable:
                                want || prev.shippingAvailable ? prev.shippingAvailable : true,
                            }))
                          }}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor="sell-boardbags-delivery-pickup"
                          className="cursor-pointer pt-0.5 text-sm font-medium leading-snug"
                        >
                          Local pickup
                        </Label>
                      </div>
                    </div>
                  </div>

                  {form.shippingAvailable ? (
                    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
                      <h3 className="text-sm font-semibold text-foreground">
                        Shipping cost in the Continental U.S.{" "}
                        <span className="text-destructive" aria-hidden>
                          *
                        </span>
                      </h3>
                      <RadioGroup
                        value={form.shippingMode}
                        onValueChange={(value) =>
                          setField("shippingMode", value as "reswell" | "free" | "flat")
                        }
                        className="space-y-3"
                      >
                        <label
                          htmlFor="sell-boardbags-ship-mode-reswell"
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                            form.shippingMode === "reswell"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/35",
                          )}
                        >
                          <RadioGroupItem
                            value="reswell"
                            id="sell-boardbags-ship-mode-reswell"
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1 flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium leading-snug text-foreground">
                                Let Reswell determine the shipping cost for you
                              </span>
                              <Badge
                                variant="default"
                                className="h-auto shrink-0 border-0 bg-listingHeart px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#2a4170]"
                              >
                                Recommended
                              </Badge>
                            </div>
                            {form.shippingMode === "reswell" ? (
                              <p className="text-sm leading-relaxed text-muted-foreground/45">
                                We&apos;ll calculate shipping from your packed dimensions and add it
                                to the buyer&apos;s total at checkout. When an order is placed,
                                we&apos;ll email you the shipping label.{" "}
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
                          htmlFor="sell-boardbags-ship-mode-free"
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                            form.shippingMode === "free"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/35",
                          )}
                        >
                          <RadioGroupItem value="free" id="sell-boardbags-ship-mode-free" className="mt-0.5" />
                          <div className="min-w-0 flex-1 flex-col gap-1.5">
                            <span className="text-sm font-medium leading-snug text-foreground">
                              Offer free shipping
                            </span>
                            {form.shippingMode === "free" ? (
                              <p className="text-sm leading-relaxed text-muted-foreground/45">
                                Attract more buyers by covering shipping — you can adjust your list
                                price to account for the cost.
                              </p>
                            ) : null}
                          </div>
                        </label>
                        <label
                          htmlFor="sell-boardbags-ship-mode-flat"
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                            form.shippingMode === "flat"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/35",
                          )}
                        >
                          <RadioGroupItem value="flat" id="sell-boardbags-ship-mode-flat" className="mt-0.5" />
                          <div className="min-w-0 flex-1 flex-col gap-1.5">
                            <span className="text-sm font-medium leading-snug text-foreground">
                              Set a flat shipping rate
                            </span>
                            {form.shippingMode === "flat" ? (
                              <p className="text-sm leading-relaxed text-muted-foreground/45">
                                One cost that all buyers in the Continental U.S. will pay at checkout.
                              </p>
                            ) : null}
                          </div>
                        </label>
                      </RadioGroup>
                      {form.shippingMode === "flat" ? (
                        <div className="space-y-2 rounded-lg border border-border bg-background p-4 sm:p-5">
                          <Label htmlFor="boardbag-shipping-price" className="text-sm font-semibold text-foreground">
                            Shipping rate{" "}
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
                              id="boardbag-shipping-price"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={form.shippingPrice}
                              onChange={(e) => setField("shippingPrice", e.target.value)}
                              className="pl-8 tabular-nums placeholder:text-muted-foreground/45"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </SellFormSection>

              {form.shippingAvailable && form.shippingMode === "reswell" ? (
                <SellFormSection
                  sectionId="sell-boardbags-section-reswell-package"
                  title="Reswell shipping: packed size & weight"
                >
                  <ReswellPackageDimensionsCard
                    showHeading={false}
                    className="rounded-none border-0 bg-transparent p-0 shadow-none"
                    lengthIn={form.reswellPackageLengthIn}
                    widthIn={form.reswellPackageWidthIn}
                    heightIn={form.reswellPackageHeightIn}
                    weightLb={form.reswellPackageWeightLb}
                    weightOz={form.reswellPackageWeightOz}
                    onLengthInChange={(v) =>
                      setField("reswellPackageLengthIn", normalizeBoardLengthInput(v))
                    }
                    onWidthInChange={(v) =>
                      setField("reswellPackageWidthIn", normalizeTapeStyleInchesInput(v))
                    }
                    onHeightInChange={(v) =>
                      setField("reswellPackageHeightIn", normalizeTapeStyleInchesInput(v))
                    }
                    onWeightLbChange={(v) => setField("reswellPackageWeightLb", v)}
                    onWeightOzChange={(v) => setField("reswellPackageWeightOz", v)}
                  />
                </SellFormSection>
              ) : null}

              <SellFormSection
                sectionId="sell-boardbags-section-publish"
                title="Price & publish your listing"
              >
                <div className="space-y-6">
                  <SellPriceFields
                    listingPrice={form.price}
                    onListingPriceChange={(value) => setField("price", value)}
                    sellerPurchasePrice={form.sellerPurchasePrice}
                    onSellerPurchasePriceChange={(value) => setField("sellerPurchasePrice", value)}
                    purchaseAccordionTitle="What you paid for the boardbag"
                    purchaseAccordionDescription="Keep track of what you paid versus what it sells for. This info is for your benefit only."
                    afterListingPrice={
                      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
                        <div className="flex gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"
                            aria-hidden
                          >
                            <Zap className="h-4 w-4" strokeWidth={2.5} />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <h3 className="text-sm font-semibold text-foreground">
                              Sell your boardbag even faster
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground/45">
                              Increase your chances of selling with offers from buyers.
                            </p>
                          </div>
                        </div>

                        <Separator className="my-5" />

                        <div className="flex gap-4">
                          <Switch
                            id="sell-boardbags-buyer-offers"
                            checked={form.buyerOffers}
                            onCheckedChange={(v) => setField("buyerOffers", v === true)}
                            className="mt-0.5 shrink-0 data-[state=checked]:bg-listingHeart"
                            aria-label="Allow buyers to make offers"
                          />
                          <div className="min-w-0 space-y-1">
                            <Label
                              htmlFor="sell-boardbags-buyer-offers"
                              className="cursor-pointer text-sm font-medium text-foreground"
                            >
                              Allow buyers to make offers
                            </Label>
                            <p className="text-sm leading-relaxed text-muted-foreground/45">
                              Lets you negotiate a final price with buyers before checkout.
                            </p>
                          </div>
                        </div>
                      </div>
                    }
                  />
                  <Separator />
                  <Button
                    type="submit"
                    size="lg"
                    className="relative w-full transition-shadow"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editId ? "Saving…" : "Publishing…"}
                      </>
                    ) : editId ? (
                      "Save changes"
                    ) : (
                      "Create Listing"
                    )}
                  </Button>
                  {uploadingCount > 0 ? (
                    <p className="text-center text-xs text-muted-foreground/45">
                      {uploadingCount} photo{uploadingCount > 1 ? "s" : ""} still uploading…
                    </p>
                  ) : null}
                </div>
              </SellFormSection>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
