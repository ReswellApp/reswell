"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { Heart, Loader2, RotateCw, Upload, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { SellFinsFacetFields } from "@/components/features/sell/sell-fins-facet-fields"
import { SellPriceFields } from "@/components/features/sell/sell-price-fields"
import { ReswellPackageDimensionsCard } from "@/components/features/sell/reswell-package-dimensions-card"
import {
  SellSectionNav,
  SellSectionNavHorizontal,
  SELL_FINS_FORM_SECTION_NAV_ITEMS,
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
  FIN_LISTING_MAX_PHOTOS,
  FIN_LISTING_TITLE_MAX_LENGTH,
} from "@/lib/validations/fin-listing"
import {
  createFinListingAction,
  updateFinListingAction,
} from "@/lib/actions/finListingActions"
import { buildFinListingPersistFields } from "@/lib/fin-listing-persist-fields"
import { computeFinSellSectionCompletion } from "@/lib/fin-sell-section-completion"
import { sellFormConditionValue } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { singleFinSetupSlugForForm } from "@/lib/listing-fin-setup-tags"
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
  /** True = apply 180° after automatic landscape→portrait step (toggle). */
  userRotate180?: boolean
  /** After upload, drop `file` so the next rotation re-downloads from `url`. */
  dropSourceFileAfterUpload?: boolean
  prepareSeq?: number
}

function shippingPriceToFormValue(v: unknown): string {
  if (v == null || v === "") return ""
  const n = Number.parseFloat(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? String(n) : ""
}

function finShippingModeFromListing(listing: {
  shipping_available?: boolean | null
  shipping_price?: number | string | null
  board_shipping_cost_mode?: string | null
}): FinFormState["shippingMode"] {
  const stored = listing.board_shipping_cost_mode
  if (stored === "reswell" || stored === "free" || stored === "flat") return stored
  if (listing.shipping_available) {
    const n = Number.parseFloat(String(listing.shipping_price ?? 0).replace(/,/g, ""))
    if (Number.isFinite(n) && n > 0) return "flat"
    return "free"
  }
  return "reswell"
}

type FinFormState = {
  title: string
  description: string
  price: string
  sellerPurchasePrice: string
  condition: string
  size: string
  finSetup: string
  finSystem: string
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

const INITIAL_STATE: FinFormState = {
  title: "",
  description: "",
  price: "",
  sellerPurchasePrice: "",
  condition: "",
  size: "",
  finSetup: "",
  finSystem: "",
  brand: "",
  model: "",
  locationCity: "",
  locationState: "",
  locationLat: null,
  locationLng: null,
  locationDisplay: "",
  shippingAvailable: true,
  localPickup: false,
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

function scrollFinSellSectionIntoView(sectionId: string) {
  const el = document.getElementById(sectionId)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export default function SellFinsFlow({ editListingId = null }: { editListingId?: string | null }) {
  const router = useRouter()
  const signIn = useSignInGate()
  const fileInputId = useId()
  const supabaseRef = useRef(createClient())
  const editId = editListingId?.trim() || null

  const [form, setForm] = useState<FinFormState>(INITIAL_STATE)
  const [photos, setPhotos] = useState<PhotoSlot[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [editLoading, setEditLoading] = useState(Boolean(editId))
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])

  const photosRef = useRef<PhotoSlot[]>([])
  photosRef.current = photos
  const latestPhotoPrepareSeqRef = useRef(new Map<string, number>())

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
          signIn(`/sell/fins?edit=${editId}`)
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
        router.replace("/sell/fins", { scroll: false })
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

      if ((listing as { section?: string }).section !== "fins") {
        toast.error("Only fin listings can be edited here.")
        router.replace("/sell/fins", { scroll: false })
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
      const shippingMode = finShippingModeFromListing(
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
        size: (listing as { fin_size?: string | null }).fin_size ?? "",
        finSetup: singleFinSetupSlugForForm((listing as { fins_setup?: string | null }).fins_setup),
        finSystem: (listing as { fin_system?: string | null }).fin_system ?? "",
        brand: (listing as { brand?: string | null }).brand?.trim() ?? "",
        model: (listing as { model?: string | null }).model?.trim() ?? "",
        locationCity: listing.city ?? "",
        locationState: listing.state ?? "",
        locationLat: listing.latitude != null ? Number(listing.latitude) : null,
        locationLng: listing.longitude != null ? Number(listing.longitude) : null,
        locationDisplay: [listing.city, listing.state].filter(Boolean).join(", "),
        shippingAvailable: true,
        localPickup: false,
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

  const setField = useCallback(<K extends keyof FinFormState>(key: K, value: FinFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateSlot = useCallback((clientId: string, patch: Partial<PhotoSlot>) => {
    setPhotos((prev) => prev.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p)))
  }, [])

  const photoPrepareSeqInSync = useCallback((clientId: string, prepareSeq: number): boolean => {
    return (latestPhotoPrepareSeqRef.current.get(clientId) ?? 0) === prepareSeq
  }, [])

  const uploadSlot = useCallback(
    async (slot: PhotoSlot) => {
      const clientId = slot.clientId
      const prepareSeq = slot.prepareSeq ?? 0
      latestPhotoPrepareSeqRef.current.set(clientId, prepareSeq)
      const src = slot.file
      if (!src) return

      try {
        updateSlot(clientId, { phase: "optimizing", progress: 0 })
        const decodable = await ensureBrowserDecodableImageFile(src)
        const prepared = await prepareListingImagePairFromFile(decodable, {
          rotate180: Boolean(slot.userRotate180),
        })
        if (!photoPrepareSeqInSync(clientId, prepareSeq)) return

        setPhotos((prev) =>
          prev.map((p) => {
            if (p.clientId !== clientId) return p
            if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl)
            return {
              ...p,
              previewUrl: URL.createObjectURL(prepared.thumb),
              phase: "uploading",
              progress: 5,
            }
          }),
        )

        const supabase = supabaseRef.current
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!session?.access_token || !user) {
          if (!photoPrepareSeqInSync(clientId, prepareSeq)) return
          updateSlot(clientId, { phase: "error" })
          signIn("/sell/fins")
          return
        }

        // Coalesce progress to ~10% steps so each upload chunk doesn't re-render the whole form.
        let lastReportedPct = 5
        const { fullUrl, thumbUrl } = await uploadListingImagePairToSupabase({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          accessToken: session.access_token,
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          userId: user.id,
          clientId: slot.clientId,
          prepared,
          onProgressFull: (loaded, total) => {
            const pct = total > 0 ? Math.round((loaded / total) * 100) : 50
            if (pct < 100 && pct - lastReportedPct < 10) return
            lastReportedPct = pct
            if (!photoPrepareSeqInSync(clientId, prepareSeq)) return
            updateSlot(clientId, { progress: pct })
          },
        })

        if (!photoPrepareSeqInSync(clientId, prepareSeq)) return

        updateSlot(clientId, {
          phase: "done",
          progress: 100,
          url: fullUrl,
          thumbnailUrl: thumbUrl,
          ...(slot.dropSourceFileAfterUpload
            ? { file: undefined, dropSourceFileAfterUpload: undefined }
            : {}),
        })
      } catch (err) {
        if (!photoPrepareSeqInSync(clientId, prepareSeq)) return
        console.error("fin photo upload failed", err)
        updateSlot(clientId, { phase: "error" })
        toast.error(friendlyListingPhotoErrorMessage(err, "upload"))
      }
    },
    [photoPrepareSeqInSync, signIn, updateSlot],
  )

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"))
      if (list.length === 0) return

      const remaining = FIN_LISTING_MAX_PHOTOS - photosRef.current.length
      if (remaining <= 0) {
        toast.error(`You can add up to ${FIN_LISTING_MAX_PHOTOS} photos.`)
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
      if (target?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.clientId !== clientId)
    })
  }, [])

  const rotatePhoto180 = useCallback(
    (clientId: string) => {
      const live = photosRef.current.find((p) => p.clientId === clientId)
      if (!live) return
      if (live.phase === "error") return
      if (live.phase === "optimizing" || live.phase === "uploading") return

      if (live.file) {
        let nextSlot: PhotoSlot | null = null
        setPhotos((prev) =>
          prev.map((p) => {
            if (p.clientId !== clientId) return p
            const src = p.file
            if (!src) return p
            if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl)
            const nextSeq = (p.prepareSeq ?? 0) + 1
            latestPhotoPrepareSeqRef.current.set(clientId, nextSeq)
            nextSlot = {
              ...p,
              userRotate180: !p.userRotate180,
              prepareSeq: nextSeq,
              phase: "optimizing",
              progress: 0,
              url: undefined,
              thumbnailUrl: undefined,
              previewUrl: URL.createObjectURL(src),
            }
            return nextSlot
          }),
        )
        if (nextSlot) void uploadSlot(nextSlot)
        return
      }

      const fullUrl = (live.url ?? "").trim()
      if (!fullUrl || live.phase !== "done") return

      const snapshot = { ...live }
      setPhotos((prev) =>
        prev.map((p) =>
          p.clientId === clientId ? { ...p, phase: "optimizing", progress: 0 } : p,
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

          let nextSlot: PhotoSlot | null = null
          setPhotos((prev) =>
            prev.map((p) => {
              if (p.clientId !== clientId) return p
              if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl)
              const nextSeq = (p.prepareSeq ?? 0) + 1
              latestPhotoPrepareSeqRef.current.set(clientId, nextSeq)
              nextSlot = {
                ...p,
                userRotate180: !p.userRotate180,
                prepareSeq: nextSeq,
                phase: "optimizing",
                progress: 0,
                url: undefined,
                thumbnailUrl: undefined,
                previewUrl: URL.createObjectURL(file),
                file,
                dropSourceFileAfterUpload: true,
              }
              return nextSlot
            }),
          )
          if (nextSlot) void uploadSlot(nextSlot)
        } catch (e) {
          toast.error(friendlyListingPhotoErrorMessage(e, "rotate"))
          setPhotos((prev) => prev.map((p) => (p.clientId === clientId ? snapshot : p)))
        }
      })()
    },
    [uploadSlot],
  )

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
      computeFinSellSectionCompletion({
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
      signIn("/sell/fins")
      return
    }

    if (readyPhotos.length === 0) {
      toast.error("Add at least one photo.")
      scrollFinSellSectionIntoView("sell-fins-section-photos-title")
      return
    }
    if (uploadingCount > 0) {
      toast.error("Hang tight — your photos are still uploading.")
      return
    }
    if (!form.title.trim()) {
      toast.error("Add a title.")
      scrollFinSellSectionIntoView("sell-fins-section-photos-title")
      return
    }
    if (!form.condition) {
      toast.error("Choose a condition.")
      scrollFinSellSectionIntoView("sell-fins-section-details")
      return
    }
    if (!form.description.trim()) {
      toast.error("Add a description.")
      scrollFinSellSectionIntoView("sell-fins-section-details")
      return
    }
    if (!form.price.trim() || Number(form.price) <= 0) {
      toast.error("Enter a price.")
      scrollFinSellSectionIntoView("sell-fins-section-publish")
      return
    }
    if (!form.locationCity.trim() || !form.locationState.trim()) {
      toast.error("Confirm where you're listing from.")
      scrollFinSellSectionIntoView("sell-fins-section-delivery")
      return
    }
    if (!form.shippingAvailable) {
      toast.error("Fin listings must ship.")
      scrollFinSellSectionIntoView("sell-fins-section-delivery")
      return
    }
    if (form.shippingMode === "reswell") {
      const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
      const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
      const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
      if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) {
        toast.error("Enter packed box dimensions for Reswell shipping.")
        scrollFinSellSectionIntoView("sell-fins-section-reswell-package")
        return
      }
    }
    if (
      form.shippingMode === "flat" &&
      (form.shippingPrice === "" || Number(form.shippingPrice) < 0)
    ) {
      toast.error("Enter a flat shipping rate.")
      scrollFinSellSectionIntoView("sell-fins-section-delivery")
      return
    }

    const payload = {
      title: form.title,
      description: form.description,
      price: form.price,
      condition: form.condition,
      size: form.size || null,
      finSetup: form.finSetup || null,
      finSystem: form.finSystem || null,
      brand: form.brand,
      model: form.model,
      locationCity: form.locationCity,
      locationState: form.locationState,
      locationLat: form.locationLat ?? undefined,
      locationLng: form.locationLng ?? undefined,
      shippingAvailable: true,
      localPickup: false,
      shippingCostMode: form.shippingMode,
      shippingPrice:
        form.shippingMode === "flat"
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
              listing: buildFinListingPersistFields(payload),
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

        const result = await updateFinListingAction({
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

      const result = await createFinListingAction(payload)
      if ("error" in result) {
        toast.error(result.error)
        setSubmitting(false)
        return
      }

      toast.success("Your fin is live!")
      router.push(`/l/${result.slug}`)
    } catch (err) {
      console.error("fin listing submit failed", err)
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
      <div className="container relative mx-auto max-w-2xl min-h-[50vh] lg:max-w-6xl">
        <h1 className="sr-only">{editId ? "Edit fin listing" : "List your fins"}</h1>

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
                    {editId ? "Edit fin listing" : "List fins"}
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
              items={SELL_FINS_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
            />
          </div>

          <div className="min-w-0 w-full max-w-2xl lg:w-auto lg:max-w-3xl lg:shrink-0">
            <SellSectionNavHorizontal
              items={SELL_FINS_FORM_SECTION_NAV_ITEMS}
              sectionCompletion={sellSectionCompletion}
              className="mb-8 hidden md:block lg:hidden"
            />

            <form onSubmit={handleSubmit} className="space-y-10 lg:space-y-12" aria-busy={submitting}>
              <SellFormSection
                sectionId="sell-fins-section-photos-title"
                title="Title & photos"
                description="Write a title in your own words. It's what buyers see first. Add clear photos of your fins."
              >
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-2">
                      <Label htmlFor="fin-title">Title *</Label>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          form.title.length > FIN_LISTING_TITLE_MAX_LENGTH
                            ? "font-medium text-destructive"
                            : "text-muted-foreground/45",
                        )}
                        aria-live="polite"
                      >
                        {form.title.length}/{FIN_LISTING_TITLE_MAX_LENGTH}
                      </span>
                    </div>
                    <Input
                      id="fin-title"
                      className="placeholder:text-muted-foreground/45"
                      placeholder="e.g. FCS II Performer Tri Fins — Medium"
                      value={form.title}
                      maxLength={FIN_LISTING_TITLE_MAX_LENGTH}
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
                      {photos.map((photo, index) => {
                        const canRotate =
                          photo.phase !== "error" &&
                          photo.phase !== "optimizing" &&
                          photo.phase !== "uploading" &&
                          (Boolean(photo.file) ||
                            (photo.phase === "done" && Boolean((photo.url ?? "").trim())))

                        return (
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
                          {index === 0 && photo.phase === "done" ? (
                            <span className="absolute bottom-1.5 left-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                              Main
                            </span>
                          ) : null}
                          <div
                            className={cn(
                              "absolute inset-x-1 top-1 flex gap-1",
                              canRotate ? "justify-between" : "justify-end",
                            )}
                          >
                            {canRotate ? (
                              <button
                                type="button"
                                onClick={() => rotatePhoto180(photo.clientId)}
                                className="rounded-full bg-background/90 p-1 text-foreground shadow-sm hover:bg-background"
                                title="Rotate 180°"
                                aria-label={`Rotate photo ${index + 1} 180 degrees`}
                              >
                                <RotateCw className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            ) : null}
                            <div className="flex gap-1">
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
                        </div>
                        )
                      })}
                      {photos.length < FIN_LISTING_MAX_PHOTOS ? (
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
                sectionId="sell-fins-section-details"
                title="Fin details & description"
                description="Setup, system, and size help buyers find the right set."
              >
                <div className="space-y-8">
                  <SellFinsFacetFields
                    condition={form.condition}
                    finSetup={form.finSetup}
                    finSystem={form.finSystem}
                    size={form.size}
                    brand={form.brand}
                    model={form.model}
                    onConditionChange={(v) => setField("condition", v)}
                    onFinSetupChange={(v) => setField("finSetup", v)}
                    onFinSystemChange={(v) => setField("finSystem", v)}
                    onSizeChange={(v) => setField("size", v)}
                    onBrandChange={(v) => setField("brand", v)}
                    onModelChange={(v) => setField("model", v)}
                  />

                  <Separator className="bg-border" />

                  <div className="space-y-2">
                    <Label htmlFor="fin-description">Description *</Label>
                    <Textarea
                      id="fin-description"
                      value={form.description}
                      rows={5}
                      placeholder="Material, ride feel, any wear or repairs, why you're selling…"
                      className="placeholder:text-muted-foreground/45"
                      onChange={(e) => setField("description", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </SellFormSection>

              <SellFormSection
                sectionId="sell-fins-section-delivery"
                title="Shipping"
                description="Pin where you're shipping from and choose how shipping works. Fin listings ship only — local pickup isn't available."
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
                          htmlFor="sell-fins-ship-mode-reswell"
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                            form.shippingMode === "reswell"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/35",
                          )}
                        >
                          <RadioGroupItem
                            value="reswell"
                            id="sell-fins-ship-mode-reswell"
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
                          htmlFor="sell-fins-ship-mode-free"
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                            form.shippingMode === "free"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/35",
                          )}
                        >
                          <RadioGroupItem value="free" id="sell-fins-ship-mode-free" className="mt-0.5" />
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
                          htmlFor="sell-fins-ship-mode-flat"
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                            form.shippingMode === "flat"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/35",
                          )}
                        >
                          <RadioGroupItem value="flat" id="sell-fins-ship-mode-flat" className="mt-0.5" />
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
                          <Label htmlFor="fin-shipping-price" className="text-sm font-semibold text-foreground">
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
                              id="fin-shipping-price"
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
                </div>
              </SellFormSection>

              {form.shippingMode === "reswell" ? (
                <SellFormSection
                  sectionId="sell-fins-section-reswell-package"
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
                sectionId="sell-fins-section-publish"
                title="Price & publish your listing"
              >
                <div className="space-y-6">
                  <SellPriceFields
                    listingPrice={form.price}
                    onListingPriceChange={(value) => setField("price", value)}
                    sellerPurchasePrice={form.sellerPurchasePrice}
                    onSellerPurchasePriceChange={(value) => setField("sellerPurchasePrice", value)}
                    purchaseAccordionTitle="What you paid for the fins"
                    purchaseAccordionDescription="Keep track of what you paid versus what they sell for. This info is for your benefit only."
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
                              Sell your fins even faster
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground/45">
                              Increase your chances of selling with offers from buyers.
                            </p>
                          </div>
                        </div>

                        <Separator className="my-5" />

                        <div className="flex gap-4">
                          <Switch
                            id="sell-fins-buyer-offers"
                            checked={form.buyerOffers}
                            onCheckedChange={(v) => setField("buyerOffers", v === true)}
                            className="mt-0.5 shrink-0 data-[state=checked]:bg-listingHeart"
                            aria-label="Allow buyers to make offers"
                          />
                          <div className="min-w-0 space-y-1">
                            <Label
                              htmlFor="sell-fins-buyer-offers"
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
