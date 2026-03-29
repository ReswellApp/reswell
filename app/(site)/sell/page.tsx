"use client"

import React, { Suspense } from "react"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { ArrowLeft, Upload, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react"
import { LocationPicker } from "@/components/location-picker"
import {
  boardFulfillmentFromFlags,
  flagsFromBoardFulfillment,
  type BoardFulfillmentChoice,
} from "@/lib/listing-fulfillment"
import { slugify } from "@/lib/slugify"
import { clearImpersonation, getImpersonation, type ImpersonationData } from "@/lib/impersonation"
import {
  FINS_TYPE_OPTIONS,
  SINGLE_FIN_SIZE_OPTIONS,
  USED_GEAR_COLOR_OPTIONS,
  USED_GEAR_SIZE_OPTIONS,
} from "@/lib/used-gear-filter-options"
import { BOARD_BAG_LENGTH_OPTIONS } from "@/lib/board-bag-length-options"
import {
  APPAREL_KIND_OPTIONS,
  APPAREL_KIND_VALUES,
  APPAREL_SIZE_OPTIONS,
  type ApparelKindValue,
} from "@/lib/apparel-lifestyle-options"
import {
  WETSUIT_SIZE_OPTIONS,
  WETSUIT_THICKNESS_OPTIONS,
  WETSUIT_ZIP_OPTIONS,
  WETSUIT_ZIP_VALUES,
  type WetsuitZipValue,
} from "@/lib/wetsuit-options"
import { LEASH_LENGTH_FT_OPTIONS, LEASH_THICKNESS_OPTIONS, leashLengthLabel } from "@/lib/leash-options"
import {
  COLLECTIBLE_TYPE_OPTIONS,
  COLLECTIBLE_TYPE_VALUES,
  COLLECTIBLE_ERA_OPTIONS,
  COLLECTIBLE_ERA_VALUES,
  COLLECTIBLE_CONDITION_OPTIONS,
  COLLECTIBLE_CONDITION_VALUES,
  type CollectibleTypeValue,
  type CollectibleEraValue,
  type CollectibleConditionValue,
} from "@/lib/collectible-options"
import type { IndexBoardModelSelection } from "@/components/index-board-model-combobox"
import {
  SurfboardTitleIndexInput,
  titleFromIndexModelPick,
} from "@/components/surfboard-title-index-input"
import { listingTitleWithBoardLength } from "@/lib/listing-title-board-length"

// Used gear categories (ids match public.categories). Hardware & Accessories and Travel & Storage removed from used section.
const WETSUITS_CATEGORY_ID = "2744c29e-d6d4-43d9-a3ee-5bc11a0027df"
const LEASHES_CATEGORY_ID = "b2a6282c-4c23-42dc-83f4-492eaa4f993a"
const FINS_CATEGORY_ID = "f8327e72-d54c-4333-b383-58a8cef225a6"
const BACKPACK_CATEGORY_ID = "a6000006-0000-4000-8000-000000000006"
const BOARD_BAGS_CATEGORY_ID = "3779de38-dcf8-430f-a42c-9a17a2e048c4"
const APPAREL_LIFESTYLE_CATEGORY_ID = "a2000002-0000-4000-8000-000000000002"
const COLLECTIBLES_CATEGORY_ID = "a3000003-0000-4000-8000-000000000003"

const categories = [
  { value: WETSUITS_CATEGORY_ID, label: "Wetsuits" },
  { value: APPAREL_LIFESTYLE_CATEGORY_ID, label: "Apparel & Lifestyle" },
  { value: FINS_CATEGORY_ID, label: "Fins" },
  { value: LEASHES_CATEGORY_ID, label: "Leashes" },
  { value: BOARD_BAGS_CATEGORY_ID, label: "Board Bags" },
  { value: BACKPACK_CATEGORY_ID, label: "Surfpacks & Bags" },
  { value: "a3000003-0000-4000-8000-000000000003", label: "Vintage" },
]

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

const conditions = [
  { value: "new", label: "New - Never used" },
  { value: "like_new", label: "Like New - Minimal wear" },
  { value: "good", label: "Good - Normal wear" },
  { value: "fair", label: "Fair - Shows wear but functional" },
]

const boardTypes = [
  { value: "shortboard", label: "Shortboard" },
  { value: "longboard", label: "Longboard" },
  { value: "funboard", label: "Funboard / Mid-length" },
  { value: "fish", label: "Fish" },
  { value: "gun", label: "Gun" },
  { value: "foamie", label: "Foam / Soft Top" },
  { value: "other", label: "Other" },
]

type EditableImage = {
  id?: string
  url: string
  file?: File
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
  const supabase = createClient()
  const editId = searchParams.get("edit")

  const [impersonation, setImpersonation] = useState<ImpersonationData | null>(null)
  const [editListingOwnerId, setEditListingOwnerId] = useState<string | null>(null)
  useEffect(() => { setImpersonation(getImpersonation()) }, [])
  const [loading, setLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(!!editId)
  const [listingType, setListingType] = useState<"used" | "board">("used")
  const [images, setImages] = useState<EditableImage[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "",
    brand: "",
    gearSize: "",
    gearColor: "",
    packKind: "" as "" | "surfpack" | "bag",
    boardBagKind: "" as "" | "day" | "travel",
    apparelKind: "" as "" | ApparelKindValue,
    wetsuitSize: "",
    wetsuitThickness: "",
    wetsuitZipType: "" as "" | WetsuitZipValue,
    leashLength: "",
    leashThickness: "",
    collectibleType: "" as "" | CollectibleTypeValue,
    collectibleEra: "" as "" | CollectibleEraValue,
    collectibleCondition: "" as "" | CollectibleConditionValue,
    boardFulfillment: "shipping_only" as BoardFulfillmentChoice,
    boardShippingPrice: "0",
    boardType: "",
    boardLength: "",
    boardIndexBrandSlug: "",
    boardIndexModelSlug: "",
    boardIndexLabel: "",
    locationLat: 0,
    locationLng: 0,
    locationCity: "",
    locationState: "",
    locationDisplay: "",
  })

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
          user_id,
          section,
          title,
          description,
          price,
          condition,
          category_id,
          board_type,
          length_feet,
          length_inches,
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
          gear_size,
          gear_color,
          pack_kind,
          board_bag_kind,
          apparel_kind,
          wetsuit_size,
          wetsuit_thickness,
          wetsuit_zip_type,
          leash_length,
          leash_thickness,
          collectible_type,
          collectible_era,
          collectible_condition,
          listing_images (id, url, is_primary, sort_order)
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
      setEditListingOwnerId(listing.user_id as string)
      if (imp && imp.userId !== listing.user_id) {
        clearImpersonation()
        setImpersonation(null)
      }
      const section = listing.section === "surfboards" ? "board" : (listing.section as "used")
      setListingType(section)
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
        gearSize: (listing as { gear_size?: string | null }).gear_size?.trim() ?? "",
        gearColor: (listing as { gear_color?: string | null }).gear_color?.trim() ?? "",
        packKind: (() => {
          const pk = (listing as { pack_kind?: string | null }).pack_kind?.trim()
          return pk === "surfpack" || pk === "bag" ? pk : ""
        })(),
        boardBagKind: (() => {
          const bk = (listing as { board_bag_kind?: string | null }).board_bag_kind?.trim()
          return bk === "day" || bk === "travel" ? bk : ""
        })(),
        apparelKind: (() => {
          const ak = (listing as { apparel_kind?: string | null }).apparel_kind?.trim()
          if (!ak) return ""
          return APPAREL_KIND_VALUES.includes(ak as ApparelKindValue) ? (ak as ApparelKindValue) : ""
        })(),
        wetsuitSize: (() => {
          const s = (listing as { wetsuit_size?: string | null }).wetsuit_size?.trim() ?? ""
          return (WETSUIT_SIZE_OPTIONS as readonly string[]).includes(s) ? s : ""
        })(),
        wetsuitThickness: (() => {
          const t = (listing as { wetsuit_thickness?: string | null }).wetsuit_thickness?.trim() ?? ""
          return (WETSUIT_THICKNESS_OPTIONS as readonly string[]).includes(t) ? t : ""
        })(),
        wetsuitZipType: (() => {
          const z = (listing as { wetsuit_zip_type?: string | null }).wetsuit_zip_type?.trim() ?? ""
          const normalized = z === "non_hooded" ? "chestzip" : z
          return WETSUIT_ZIP_VALUES.includes(normalized as WetsuitZipValue)
            ? (normalized as WetsuitZipValue)
            : ""
        })(),
        leashLength: (() => {
          const l = (listing as { leash_length?: string | null }).leash_length?.trim() ?? ""
          return (LEASH_LENGTH_FT_OPTIONS as readonly string[]).includes(l) ? l : ""
        })(),
        leashThickness: (() => {
          const t = (listing as { leash_thickness?: string | null }).leash_thickness?.trim() ?? ""
          return (LEASH_THICKNESS_OPTIONS as readonly string[]).includes(t) ? t : ""
        })(),
        collectibleType: (() => {
          const v = (listing as { collectible_type?: string | null }).collectible_type?.trim() ?? ""
          return (COLLECTIBLE_TYPE_VALUES as readonly string[]).includes(v) ? (v as CollectibleTypeValue) : ""
        })(),
        collectibleEra: (() => {
          const v = (listing as { collectible_era?: string | null }).collectible_era?.trim() ?? ""
          return (COLLECTIBLE_ERA_VALUES as readonly string[]).includes(v) ? (v as CollectibleEraValue) : ""
        })(),
        collectibleCondition: (() => {
          const v = (listing as { collectible_condition?: string | null }).collectible_condition?.trim() ?? ""
          return (COLLECTIBLE_CONDITION_VALUES as readonly string[]).includes(v) ? (v as CollectibleConditionValue) : ""
        })(),
        boardFulfillment: loadedFulfillment,
        boardShippingPrice,
        boardType: listing.board_type ?? "",
        boardLength: lengthFeet && lengthInches ? `${lengthFeet}'${lengthInches}"` : "",
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
        .map((img: any) => ({
          id: img.id as string,
          url: img.url as string,
        }))
      setImages(existingImages)
      setRemovedImageIds([])
      setEditLoading(false)
    })()
    return () => { mounted = false }
  }, [editId, supabase, router])

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

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    const newFiles = Array.from(e.target.files)
    if (images.length + newFiles.length > 12) {
      toast.error("Maximum 12 photos allowed. You have " + images.length + ".")
      e.target.value = ""
      return
    }
    const next: EditableImage[] = []
    for (const originalFile of newFiles) {
      try {
        const file = await toJpegIfUnsupported(originalFile)
        let dims: { width: number; height: number } | null = null
        try {
          dims = await getImageDimensions(file)
        } catch { /* accept */ }

        if (dims && dims.height <= dims.width) {
          toast.error(`"${file.name}" is not vertical. Please upload portrait (vertical) photos only — height must be greater than width.`)
          continue
        }

        next.push({ file, url: URL.createObjectURL(file) })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Conversion failed"
        toast.error(`Could not convert "${originalFile.name}" to JPEG: ${msg}`)
      }
    }
    if (next.length) {
      setImages((prev) => [...prev, ...next])
    }
    e.target.value = ""
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const toRemove = prev[index]
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

  async function browserCanDecodeImage(file: File): Promise<boolean> {
    try {
      const b = await createImageBitmap(file)
      b.close()
      return true
    } catch {
      return false
    }
  }

  /** If the browser cannot decode this file (HEIC, odd formats), convert to JPEG on the server. */
  async function toJpegIfUnsupported(file: File): Promise<File> {
    if (await browserCanDecodeImage(file)) return file
    return convertViaServer(file)
  }

  /**
   * Resize images >12 MP down to 12 MP keeping aspect ratio, then
   * progressively compress to JPEG until the file fits comfortably
   * within typical storage limits (~4.5 MB).  Uses multi-step
   * downscaling for best visual quality on large reductions.
   */
  async function compressImage(file: File): Promise<File> {
    const MAX_PIXELS = 12_000_000
    const MAX_BYTES  = 4.5 * 1024 * 1024

    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap
    const totalPixels = width * height

    if (totalPixels > MAX_PIXELS) {
      const scale = Math.sqrt(MAX_PIXELS / totalPixels)
      width  = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    const canvas  = document.createElement("canvas")
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext("2d")!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image"

    let quality = 0.92
    while (quality >= 0.5) {
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", quality),
      )
      if (blob.size <= MAX_BYTES || quality <= 0.5) {
        return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" })
      }
      quality -= 0.05
    }

    const finalBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.5),
    )
    return new File([finalBlob], `${baseName}.jpg`, { type: "image/jpeg" })
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

  /** Decode unsupported formats via server, then resize/compress for storage. */
  async function preparePhotoForStorage(file: File): Promise<File> {
    const decoded = await toJpegIfUnsupported(file)
    try {
      return await compressImage(decoded)
    } catch {
      const again = await convertViaServer(file)
      return await compressImage(again)
    }
  }

  async function uploadImagesToStorage(userId: string): Promise<string[]> {
    const urls: string[] = []
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      if (img.url && !img.file) {
        urls.push(img.url)
        continue
      }
      if (!img.file) continue
      let fileToUpload: File
      try {
        fileToUpload = await preparePhotoForStorage(img.file)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        toast.error(`Photo ${i + 1} could not be processed: ${msg}`)
        continue
      }
      const baseName = fileToUpload.name.replace(/\.[^.]+$/i, "") || "image"
      const fileName = `${userId}/${Date.now()}-${i}-${baseName}.jpg`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("listings")
        .upload(fileName, fileToUpload, {
          contentType: "image/jpeg",
          upsert: false,
        })
      if (uploadError) {
        console.error("Upload error:", uploadError)
        toast.error(`Photo ${i + 1} failed to upload: ${uploadError.message}`)
        continue
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("listings").getPublicUrl(uploadData.path)
      urls.push(publicUrl)
    }
    return urls
  }

  async function syncListingImages(listingId: string, userId: string) {
    if (removedImageIds.length) {
      await supabase
        .from("listing_images")
        .delete()
        .in("id", removedImageIds)
        .eq("listing_id", listingId)
    }

    await Promise.all(
      images.map(async (img, index) => {
        const isPrimary = index === 0

        if (img.id) {
          const { error } = await supabase
            .from("listing_images")
            .update({
              sort_order: index,
              is_primary: isPrimary,
            })
            .eq("id", img.id)
            .eq("listing_id", listingId)
          if (error) console.error("listing_images update:", error)
          return
        }

        if (!img.file) return

        let fileToUpload: File
        try {
          fileToUpload = await preparePhotoForStorage(img.file)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unknown error"
          toast.error(`Photo ${index + 1} could not be processed: ${msg}`)
          return
        }
        const baseName = fileToUpload.name.replace(/\.[^.]+$/i, "") || "image"
        const fileName = `${userId}/${Date.now()}-${index}-${baseName}.jpg`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("listings")
          .upload(fileName, fileToUpload, {
            contentType: "image/jpeg",
            upsert: false,
          })

        if (uploadError) {
          console.error("Upload error:", uploadError)
          toast.error(`Photo ${index + 1} failed to upload: ${uploadError.message}`)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("listings").getPublicUrl(uploadData.path)

        const { error: insertError } = await supabase.from("listing_images").insert({
          listing_id: listingId,
          url: publicUrl,
          is_primary: isPrimary,
          sort_order: index,
        })
        if (insertError) {
          console.error("listing_images insert:", insertError)
          toast.error(`Photo ${index + 1} could not be saved.`)
        }
      }),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Please sign in to create a listing")
        router.push("/auth/login?redirect=/sell")
        return
      }

      if (!formData.title || !formData.price || !formData.condition) {
        toast.error("Please fill in all required fields")
        setLoading(false)
        return
      }

      if (listingType === "used" && !formData.category) {
        toast.error("Please select a category")
        setLoading(false)
        return
      }

      if (listingType === "board" && !formData.boardType) {
        toast.error("Please select a board type")
        setLoading(false)
        return
      }

      if (listingType === "used") {
        if (!formData.description?.trim()) {
          toast.error("Description is required for used items")
          setLoading(false)
          return
        }
      }

      if (listingType === "board") {
        if (!formData.boardLength?.trim()) {
          toast.error("Board length is required for surfboards")
          setLoading(false)
          return
        }
        if (!formData.description?.trim()) {
          toast.error("Description is required for surfboards")
          setLoading(false)
          return
        }
      }

      if ((listingType === "used" || listingType === "board") && images.length < 3) {
        toast.error("At least 3 photos are required for this listing")
        setLoading(false)
        return
      }

      const fulfillmentFlags =
        listingType === "used"
          ? { shipping_available: true, local_pickup: false }
          : flagsFromBoardFulfillment(formData.boardFulfillment)

      if (fulfillmentFlags.shipping_available) {
        const raw = formData.boardShippingPrice.trim()
        if (!raw) {
          toast.error("Enter a shipping price when offering shipping (use 0 for free shipping).")
          setLoading(false)
          return
        }
        const sp = parseFloat(raw)
        if (Number.isNaN(sp) || sp < 0) {
          toast.error("Shipping price must be a number ≥ 0.")
          setLoading(false)
          return
        }
      }

      const fulfillmentRow = {
        shipping_available: fulfillmentFlags.shipping_available,
        local_pickup: fulfillmentFlags.local_pickup,
        shipping_price: fulfillmentFlags.shipping_available
          ? parseFloat(formData.boardShippingPrice.trim())
          : null,
      }

      const resolvedListingTitle =
        listingType === "board" && formData.boardLength.trim()
          ? listingTitleWithBoardLength(formData.title, formData.boardLength)
          : formData.title.trim()

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
          !!impersonation &&
          impersonation.userId === editListingOwnerId &&
          user.id !== editListingOwnerId

        const editListingFields = {
          title: resolvedListingTitle,
          description: formData.description,
          price: parseFloat(formData.price),
          condition: formData.condition,
          category_id:
            listingType === "used"
              ? formData.category
              : boardCategoryMap[formData.boardType] || boardCategoryMap.other,
          board_type: listingType === "board" ? formData.boardType : null,
          length_feet:
            listingType === "board" && formData.boardLength
              ? parseInt(formData.boardLength.split("'")[0])
              : null,
          length_inches:
            listingType === "board" && formData.boardLength
              ? parseInt(formData.boardLength.split("'")[1] || "0")
              : null,
          latitude: fulfillmentRow.local_pickup && formData.locationLat ? formData.locationLat : null,
          longitude:
            fulfillmentRow.local_pickup && formData.locationLng ? formData.locationLng : null,
          city: fulfillmentRow.local_pickup ? formData.locationCity : null,
          state: fulfillmentRow.local_pickup ? formData.locationState : null,
          shipping_available: fulfillmentRow.shipping_available,
          local_pickup: fulfillmentRow.local_pickup,
          shipping_price: fulfillmentRow.shipping_price,
          brand:
            listingType === "board" && formData.brand.trim()
              ? formData.brand.trim()
              : listingType === "used" &&
                  (formData.category === FINS_CATEGORY_ID || formData.category === BACKPACK_CATEGORY_ID) &&
                  formData.brand.trim()
                ? formData.brand.trim()
                : null,
          index_brand_slug: listingType === "board" ? formData.boardIndexBrandSlug.trim() || null : null,
          index_model_slug: listingType === "board" ? formData.boardIndexModelSlug.trim() || null : null,
          index_model_label: listingType === "board" ? formData.boardIndexLabel.trim() || null : null,
          gear_size:
            listingType === "used" &&
            (formData.category === FINS_CATEGORY_ID ||
              formData.category === BACKPACK_CATEGORY_ID ||
              formData.category === BOARD_BAGS_CATEGORY_ID ||
              formData.category === APPAREL_LIFESTYLE_CATEGORY_ID) &&
            formData.gearSize.trim()
              ? formData.gearSize.trim()
              : null,
          gear_color:
            listingType === "used" &&
            (formData.category === FINS_CATEGORY_ID || formData.category === BACKPACK_CATEGORY_ID) &&
            formData.gearColor.trim()
              ? formData.gearColor.trim()
              : null,
          pack_kind:
            listingType === "used" &&
            formData.category === BACKPACK_CATEGORY_ID &&
            (formData.packKind === "surfpack" || formData.packKind === "bag")
              ? formData.packKind
              : null,
          board_bag_kind:
            listingType === "used" &&
            formData.category === BOARD_BAGS_CATEGORY_ID &&
            (formData.boardBagKind === "day" || formData.boardBagKind === "travel")
              ? formData.boardBagKind
              : null,
          apparel_kind:
            listingType === "used" &&
            formData.category === APPAREL_LIFESTYLE_CATEGORY_ID &&
            APPAREL_KIND_VALUES.includes(formData.apparelKind as ApparelKindValue)
              ? formData.apparelKind
              : null,
          wetsuit_size:
            listingType === "used" &&
            formData.category === WETSUITS_CATEGORY_ID &&
            (WETSUIT_SIZE_OPTIONS as readonly string[]).includes(formData.wetsuitSize.trim())
              ? formData.wetsuitSize.trim()
              : null,
          wetsuit_thickness:
            listingType === "used" &&
            formData.category === WETSUITS_CATEGORY_ID &&
            (WETSUIT_THICKNESS_OPTIONS as readonly string[]).includes(formData.wetsuitThickness.trim())
              ? formData.wetsuitThickness.trim()
              : null,
          wetsuit_zip_type:
            listingType === "used" &&
            formData.category === WETSUITS_CATEGORY_ID &&
            WETSUIT_ZIP_VALUES.includes(formData.wetsuitZipType as WetsuitZipValue)
              ? formData.wetsuitZipType
              : null,
          leash_length:
            listingType === "used" &&
            formData.category === LEASHES_CATEGORY_ID &&
            (LEASH_LENGTH_FT_OPTIONS as readonly string[]).includes(formData.leashLength.trim())
              ? formData.leashLength.trim()
              : null,
          leash_thickness:
            listingType === "used" &&
            formData.category === LEASHES_CATEGORY_ID &&
            (LEASH_THICKNESS_OPTIONS as readonly string[]).includes(formData.leashThickness.trim())
              ? formData.leashThickness.trim()
              : null,
          collectible_type:
            listingType === "used" &&
            formData.category === COLLECTIBLES_CATEGORY_ID &&
            (COLLECTIBLE_TYPE_VALUES as readonly string[]).includes(formData.collectibleType)
              ? formData.collectibleType
              : null,
          collectible_era:
            listingType === "used" &&
            formData.category === COLLECTIBLES_CATEGORY_ID &&
            (COLLECTIBLE_ERA_VALUES as readonly string[]).includes(formData.collectibleEra)
              ? formData.collectibleEra
              : null,
          collectible_condition:
            listingType === "used" &&
            formData.category === COLLECTIBLES_CATEGORY_ID &&
            (COLLECTIBLE_CONDITION_VALUES as readonly string[]).includes(formData.collectibleCondition)
              ? formData.collectibleCondition
              : null,
        }

        if (ownerEditsOwnListing) {
          const { data: updated, error: updateError } = await supabase
            .from("listings")
            .update({ ...editListingFields, updated_at: new Date().toISOString() })
            .eq("id", editId)
            .eq("user_id", user.id)
            .select("slug")
            .single()
          if (updateError) throw updateError
          listingSlug = updated?.slug ?? null
        } else if (adminImpersonatesListingOwner) {
          usedImpersonationListingApi = true
          const imageOps: { id?: string; url?: string; is_primary: boolean; sort_order: number }[] = []
          for (let i = 0; i < images.length; i++) {
            const img = images[i]
            if (img.id && !img.file) {
              imageOps.push({ id: img.id, is_primary: i === 0, sort_order: i })
              continue
            }
            if (!img.file) continue
            let fileToUpload: File
            try {
              fileToUpload = await preparePhotoForStorage(img.file)
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Unknown error"
              toast.error(`Photo ${i + 1} could not be processed: ${msg}`)
              continue
            }
            const baseName = fileToUpload.name.replace(/\.[^.]+$/i, "") || "image"
            const fileName = `${user.id}/${Date.now()}-${i}-${baseName}.jpg`
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("listings")
              .upload(fileName, fileToUpload, { contentType: "image/jpeg", upsert: false })
            if (uploadError) {
              toast.error(`Photo ${i + 1} failed to upload: ${uploadError.message}`)
              continue
            }
            const { data: { publicUrl } } = supabase.storage.from("listings").getPublicUrl(uploadData.path)
            imageOps.push({ url: publicUrl, is_primary: i === 0, sort_order: i })
          }

          const res = await fetch("/api/admin/impersonate/update-listing", {
            method: "PUT",
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
          description: formData.description,
          price: parseFloat(formData.price),
          condition: formData.condition,
          section: listingType === "board" ? "surfboards" : listingType,
          category_id:
            listingType === "used"
              ? formData.category
              : boardCategoryMap[formData.boardType] || boardCategoryMap.other,
          board_type: listingType === "board" ? formData.boardType : null,
          length_feet:
            listingType === "board" && formData.boardLength
              ? parseInt(formData.boardLength.split("'")[0])
              : null,
          length_inches:
            listingType === "board" && formData.boardLength
              ? parseInt(formData.boardLength.split("'")[1] || "0")
              : null,
          latitude: fulfillmentRow.local_pickup && formData.locationLat ? formData.locationLat : null,
          longitude:
            fulfillmentRow.local_pickup && formData.locationLng ? formData.locationLng : null,
          city: fulfillmentRow.local_pickup ? formData.locationCity : null,
          state: fulfillmentRow.local_pickup ? formData.locationState : null,
          shipping_available: fulfillmentRow.shipping_available,
          local_pickup: fulfillmentRow.local_pickup,
          shipping_price: fulfillmentRow.shipping_price,
          brand:
            listingType === "board" && formData.brand.trim()
              ? formData.brand.trim()
              : listingType === "used" &&
                  (formData.category === FINS_CATEGORY_ID || formData.category === BACKPACK_CATEGORY_ID) &&
                  formData.brand.trim()
                ? formData.brand.trim()
                : null,
          index_brand_slug: listingType === "board" ? formData.boardIndexBrandSlug.trim() || null : null,
          index_model_slug: listingType === "board" ? formData.boardIndexModelSlug.trim() || null : null,
          index_model_label: listingType === "board" ? formData.boardIndexLabel.trim() || null : null,
          gear_size:
            listingType === "used" &&
            (formData.category === FINS_CATEGORY_ID ||
              formData.category === BACKPACK_CATEGORY_ID ||
              formData.category === BOARD_BAGS_CATEGORY_ID ||
              formData.category === APPAREL_LIFESTYLE_CATEGORY_ID) &&
            formData.gearSize.trim()
              ? formData.gearSize.trim()
              : null,
          gear_color:
            listingType === "used" &&
            (formData.category === FINS_CATEGORY_ID || formData.category === BACKPACK_CATEGORY_ID) &&
            formData.gearColor.trim()
              ? formData.gearColor.trim()
              : null,
          pack_kind:
            listingType === "used" &&
            formData.category === BACKPACK_CATEGORY_ID &&
            (formData.packKind === "surfpack" || formData.packKind === "bag")
              ? formData.packKind
              : null,
          board_bag_kind:
            listingType === "used" &&
            formData.category === BOARD_BAGS_CATEGORY_ID &&
            (formData.boardBagKind === "day" || formData.boardBagKind === "travel")
              ? formData.boardBagKind
              : null,
          apparel_kind:
            listingType === "used" &&
            formData.category === APPAREL_LIFESTYLE_CATEGORY_ID &&
            APPAREL_KIND_VALUES.includes(formData.apparelKind as ApparelKindValue)
              ? formData.apparelKind
              : null,
          wetsuit_size:
            listingType === "used" &&
            formData.category === WETSUITS_CATEGORY_ID &&
            (WETSUIT_SIZE_OPTIONS as readonly string[]).includes(formData.wetsuitSize.trim())
              ? formData.wetsuitSize.trim()
              : null,
          wetsuit_thickness:
            listingType === "used" &&
            formData.category === WETSUITS_CATEGORY_ID &&
            (WETSUIT_THICKNESS_OPTIONS as readonly string[]).includes(formData.wetsuitThickness.trim())
              ? formData.wetsuitThickness.trim()
              : null,
          wetsuit_zip_type:
            listingType === "used" &&
            formData.category === WETSUITS_CATEGORY_ID &&
            WETSUIT_ZIP_VALUES.includes(formData.wetsuitZipType as WetsuitZipValue)
              ? formData.wetsuitZipType
              : null,
          leash_length:
            listingType === "used" &&
            formData.category === LEASHES_CATEGORY_ID &&
            (LEASH_LENGTH_FT_OPTIONS as readonly string[]).includes(formData.leashLength.trim())
              ? formData.leashLength.trim()
              : null,
          leash_thickness:
            listingType === "used" &&
            formData.category === LEASHES_CATEGORY_ID &&
            (LEASH_THICKNESS_OPTIONS as readonly string[]).includes(formData.leashThickness.trim())
              ? formData.leashThickness.trim()
              : null,
          collectible_type:
            listingType === "used" &&
            formData.category === COLLECTIBLES_CATEGORY_ID &&
            (COLLECTIBLE_TYPE_VALUES as readonly string[]).includes(formData.collectibleType)
              ? formData.collectibleType
              : null,
          collectible_era:
            listingType === "used" &&
            formData.category === COLLECTIBLES_CATEGORY_ID &&
            (COLLECTIBLE_ERA_VALUES as readonly string[]).includes(formData.collectibleEra)
              ? formData.collectibleEra
              : null,
          collectible_condition:
            listingType === "used" &&
            formData.category === COLLECTIBLES_CATEGORY_ID &&
            (COLLECTIBLE_CONDITION_VALUES as readonly string[]).includes(formData.collectibleCondition)
              ? formData.collectibleCondition
              : null,
        }

        if (impersonation) {
          usedImpersonationListingApi = true
          const imageUrls = await uploadImagesToStorage(user.id)
          const res = await fetch("/api/admin/impersonate/create-listing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listing: listingFields, images: imageUrls }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "Failed to create listing")
          listingId = data.listing_id
          listingSlug = data.slug
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

          if (listingError || !listing) throw listingError
          listingId = listing.id
          listingSlug = listing.slug ?? newSlug
        }
      }

      const sectionPath = listingType === "board" ? "boards" : "used"
      const detailPath = `/${sectionPath}/${listingSlug || listingId}`

      if (listingId) {
        if (!editId && !impersonation) {
          toast.success("Your listing is live")
          router.push(`${detailPath}?photos=pending`)
          void syncListingImages(listingId, user.id).catch((err: unknown) => {
            console.error("Background photo upload:", err)
            toast.error(
              "Some photos may not have uploaded. Open your listing to retry from edit, or add photos again.",
            )
          })
          return
        }
        if (editId && !usedImpersonationListingApi) {
          await syncListingImages(listingId, user.id)
        }
      }

      if (impersonationSellerLabel) {
        toast.success(
          editId
            ? `Listing updated for ${impersonationSellerLabel}`
            : `Listing created for ${impersonationSellerLabel}`,
        )
      } else {
        toast.success(editId ? "Listing updated" : "Listing created successfully!")
      }
      router.push(detailPath)
    } catch (error: any) {
      console.error("Error creating listing:", error?.message || error)
      toast.error(error?.message || "Failed to create listing")
    } finally {
      setLoading(false)
    }
  }

  return (
      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-2xl">
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
                {editId ? "Update your listing details" : "Sell your surf gear to the community"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {editLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Listing Type */}
                <div className="space-y-3">
                  <Label>What are you selling?</Label>
                  {editId && (
                    <p className="text-xs text-muted-foreground">
                      Listing type is fixed while editing. Fulfillment options for surfboards appear below
                      the location map.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      disabled={!!editId}
                      onClick={() => {
                        setListingType("board")
                        setFormData((prev) => ({ ...prev, boardFulfillment: "pickup_only" as BoardFulfillmentChoice, boardShippingPrice: "" }))
                      }}
                      className={`p-4 rounded-lg border-2 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        listingType === "board"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium">Surfboard</p>
                      <p className="text-sm text-muted-foreground">
                        Local pickup, shipping, or both
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={!!editId}
                      onClick={() => {
                        setListingType("used")
                        setFormData((prev) => ({ ...prev, boardFulfillment: "shipping_only" as BoardFulfillmentChoice, boardShippingPrice: "0" }))
                      }}
                      className={`p-4 rounded-lg border-2 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        listingType === "used"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium">Gear</p>
                      <p className="text-sm text-muted-foreground">
                        Wetsuits, fins, leashes, etc.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  {listingType === "board" ? (
                    <SurfboardTitleIndexInput
                      id="title"
                      placeholder={`e.g., Channel Islands Dumpster Diver - 5'6"`}
                      value={formData.title}
                      onChange={(title) => setFormData((f) => ({ ...f, title }))}
                      boardLength={formData.boardLength}
                      onSelectModel={(opt: IndexBoardModelSelection) => {
                        setFormData((f) => ({
                          ...f,
                          title: titleFromIndexModelPick(opt, f.boardLength),
                          boardIndexBrandSlug: opt.brandSlug,
                          boardIndexModelSlug: opt.modelSlug,
                          boardIndexLabel: opt.label,
                          brand: opt.brandName,
                        }))
                      }}
                      required
                    />
                  ) : (
                    <Input
                      id="title"
                      placeholder="e.g., Channel Islands Dumpster Diver - 5'6&quot;"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  )}
                </div>

                {/* Category or Board Type */}
                {listingType === "used" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.category === WETSUITS_CATEGORY_ID && (
                      <div className="grid gap-4 sm:grid-cols-3 max-w-3xl">
                        <div className="space-y-2">
                          <Label>Size</Label>
                          <Select
                            value={formData.wetsuitSize || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({ ...formData, wetsuitSize: v === "__unset__" ? "" : v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {WETSUIT_SIZE_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Thickness</Label>
                          <Select
                            value={formData.wetsuitThickness || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({ ...formData, wetsuitThickness: v === "__unset__" ? "" : v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {WETSUIT_THICKNESS_OPTIONS.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Zip type</Label>
                          <Select
                            value={formData.wetsuitZipType || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({
                                ...formData,
                                wetsuitZipType: v === "__unset__" ? "" : (v as WetsuitZipValue),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {WETSUIT_ZIP_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {formData.category === LEASHES_CATEGORY_ID && (
                      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
                        <div className="space-y-2">
                          <Label>Length</Label>
                          <Select
                            value={formData.leashLength || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({ ...formData, leashLength: v === "__unset__" ? "" : v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {LEASH_LENGTH_FT_OPTIONS.map((ft) => (
                                <SelectItem key={ft} value={ft}>
                                  {leashLengthLabel(ft)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Thickness</Label>
                          <Select
                            value={formData.leashThickness || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({ ...formData, leashThickness: v === "__unset__" ? "" : v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {LEASH_THICKNESS_OPTIONS.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {`${t}"`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {formData.category === COLLECTIBLES_CATEGORY_ID && (
                      <div className="grid gap-4 sm:grid-cols-3 max-w-3xl">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={formData.collectibleType || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({
                                ...formData,
                                collectibleType: v === "__unset__" ? "" : (v as CollectibleTypeValue),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {COLLECTIBLE_TYPE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Era</Label>
                          <Select
                            value={formData.collectibleEra || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({
                                ...formData,
                                collectibleEra: v === "__unset__" ? "" : (v as CollectibleEraValue),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {COLLECTIBLE_ERA_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Condition</Label>
                          <Select
                            value={formData.collectibleCondition || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({
                                ...formData,
                                collectibleCondition: v === "__unset__" ? "" : (v as CollectibleConditionValue),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {COLLECTIBLE_CONDITION_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {formData.category === FINS_CATEGORY_ID && (
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={formData.brand || "__unset__"}
                            onValueChange={(v) => {
                              const newBrand = v === "__unset__" ? "" : v
                              const sizeOpts =
                                newBrand === "Single Fin"
                                  ? (SINGLE_FIN_SIZE_OPTIONS as readonly string[])
                                  : (USED_GEAR_SIZE_OPTIONS as readonly string[])
                              let nextGearSize = formData.gearSize
                              if (nextGearSize && !sizeOpts.includes(nextGearSize)) {
                                nextGearSize = ""
                              }
                              setFormData({ ...formData, brand: newBrand, gearSize: nextGearSize })
                            }}
                          >
                            <SelectTrigger id="fins-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {formData.brand &&
                              !(FINS_TYPE_OPTIONS as readonly string[]).includes(formData.brand) ? (
                                <SelectItem value={formData.brand}>
                                  {formData.brand} (saved)
                                </SelectItem>
                              ) : null}
                              {FINS_TYPE_OPTIONS.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Size</Label>
                          <Select
                            value={formData.gearSize || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({ ...formData, gearSize: v === "__unset__" ? "" : v })
                            }
                          >
                            <SelectTrigger id="fins-size">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {(() => {
                                const sizeOpts =
                                  formData.brand === "Single Fin"
                                    ? SINGLE_FIN_SIZE_OPTIONS
                                    : USED_GEAR_SIZE_OPTIONS
                                const inList = (sizeOpts as readonly string[]).includes(
                                  formData.gearSize,
                                )
                                return formData.gearSize && !inList ? (
                                  <SelectItem value={formData.gearSize}>
                                    {formData.gearSize} (saved)
                                  </SelectItem>
                                ) : null
                              })()}
                              {(formData.brand === "Single Fin"
                                ? SINGLE_FIN_SIZE_OPTIONS
                                : USED_GEAR_SIZE_OPTIONS
                              ).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <Select
                            value={formData.gearColor || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({ ...formData, gearColor: v === "__unset__" ? "" : v })
                            }
                          >
                            <SelectTrigger id="fins-color">
                              <SelectValue placeholder="Select color" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {formData.gearColor &&
                              !(USED_GEAR_COLOR_OPTIONS as readonly string[]).includes(
                                formData.gearColor,
                              ) ? (
                                <SelectItem value={formData.gearColor}>
                                  {formData.gearColor} (saved)
                                </SelectItem>
                              ) : null}
                              {USED_GEAR_COLOR_OPTIONS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {formData.category === BACKPACK_CATEGORY_ID && (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                          <Label>Pack type</Label>
                          <Select
                            value={formData.packKind || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({
                                ...formData,
                                packKind: v === "__unset__" ? "" : (v as "surfpack" | "bag"),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              <SelectItem value="surfpack">Surfpack</SelectItem>
                              <SelectItem value="bag">Bag</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pack-brand">Brand</Label>
                          <Input
                            id="pack-brand"
                            placeholder="e.g., Dakine"
                            value={formData.brand}
                            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Size</Label>
                          <Select
                            value={formData.gearSize || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({ ...formData, gearSize: v === "__unset__" ? "" : v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Any" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {USED_GEAR_SIZE_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <Select
                            value={formData.gearColor || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({ ...formData, gearColor: v === "__unset__" ? "" : v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Any" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {USED_GEAR_COLOR_OPTIONS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {formData.category === BOARD_BAGS_CATEGORY_ID && (
                      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
                        <div className="space-y-2">
                          <Label>Board bag type</Label>
                          <Select
                            value={formData.boardBagKind || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({
                                ...formData,
                                boardBagKind: v === "__unset__" ? "" : (v as "day" | "travel"),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              <SelectItem value="day">Day bag</SelectItem>
                              <SelectItem value="travel">Travel bag</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Fits board length</Label>
                          <Select
                            value={formData.gearSize || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({ ...formData, gearSize: v === "__unset__" ? "" : v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {BOARD_BAG_LENGTH_OPTIONS.map((len) => (
                                <SelectItem key={len} value={len}>
                                  {len}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {formData.category === APPAREL_LIFESTYLE_CATEGORY_ID && (
                      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
                        <div className="space-y-2">
                          <Label>Item type</Label>
                          <Select
                            value={formData.apparelKind || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({
                                ...formData,
                                apparelKind: v === "__unset__" ? "" : (v as ApparelKindValue),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {APPAREL_KIND_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Size</Label>
                          <Select
                            value={formData.gearSize || "__unset__"}
                            onValueChange={(v) =>
                              setFormData({ ...formData, gearSize: v === "__unset__" ? "" : v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">Not specified</SelectItem>
                              {APPAREL_SIZE_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Board Type *</Label>
                        <Select
                          value={formData.boardType}
                          onValueChange={(value) => setFormData({ ...formData, boardType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {boardTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="boardLength">Board Length *</Label>
                        <Input
                          id="boardLength"
                          placeholder={`e.g., 6'2"`}
                          value={formData.boardLength}
                          onChange={(e) => setFormData({ ...formData, boardLength: e.target.value })}
                          required={listingType === "board"}
                        />
                      </div>
                    </div>
                    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-4">
                      {formData.boardIndexBrandSlug && formData.boardIndexModelSlug ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm">
                          <span className="text-muted-foreground">
                            Linked to index:{" "}
                            <span className="font-medium text-foreground">
                              {formData.boardIndexLabel ||
                                `${formData.boardIndexModelSlug} — ${formData.boardIndexBrandSlug}`}
                            </span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 text-muted-foreground"
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
                      ) : null}
                      <div className="space-y-2">
                        <Label htmlFor="surf-brand">Brand / shaper (optional)</Label>
                        <Input
                          id="surf-brand"
                          placeholder="Pre-filled when you pick a directory model from the title; edit anytime"
                          value={formData.brand}
                          onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {listingType === "used" ? (
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <div className="space-y-2">
                      <Label>Shipping</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, boardFulfillment: "shipping_only", boardShippingPrice: "0" })
                          }
                          className={`rounded-lg border-2 p-3 text-left text-sm transition-colors ${
                            formData.boardFulfillment === "shipping_only" && formData.boardShippingPrice === "0"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <p className="font-medium">Free shipping</p>
                          <p className="text-xs text-muted-foreground mt-0.5">No extra cost to buyer</p>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              boardFulfillment: "shipping_only",
                              boardShippingPrice: formData.boardShippingPrice === "0" ? "" : formData.boardShippingPrice,
                            })
                          }
                          className={`rounded-lg border-2 p-3 text-left text-sm transition-colors ${
                            formData.boardFulfillment === "shipping_only" && formData.boardShippingPrice !== "0"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <p className="font-medium">Charge for shipping</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Set a flat shipping fee</p>
                        </button>
                      </div>
                    </div>
                    {formData.boardShippingPrice !== "0" && (
                      <div className="space-y-2">
                        <Label htmlFor="boardShippingPrice">Shipping price ($) *</Label>
                        <Input
                          id="boardShippingPrice"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="e.g. 8.99"
                          value={formData.boardShippingPrice}
                          onChange={(e) =>
                            setFormData({ ...formData, boardShippingPrice: e.target.value })
                          }
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <div className="space-y-2">
                      <Label>How can buyers get this board? *</Label>
                      <p className="text-xs text-muted-foreground">
                        Pickup uses the map location below. If you ship, set a flat shipping price (use 0
                        for free shipping).
                      </p>
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

                  {(formData.boardFulfillment === "pickup_only" ||
                    formData.boardFulfillment === "pickup_and_shipping") && (
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
                  )}
                  </>
                )}

                {/* Price & Condition */}
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
                        {conditions.map((cond) => (
                          <SelectItem key={cond.value} value={cond.value}>
                            {cond.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Description{(listingType === "used" || listingType === "board") ? " *" : ""}
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your item - include details about size, wear, included accessories, etc."
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required={listingType === "used" || listingType === "board"}
                  />
                </div>

                {/* Used items are shipping only — no toggle; always shipped */}
                {listingType === "used" && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-medium text-foreground">Shipping only</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Used items are shipped to the buyer. Coordinate shipping details in messages after purchase.
                    </p>
                  </div>
                )}

                {/* Images */}
                <div className="space-y-2">
                  <Label>Photos (3–12 required)</Label>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {images.map((image, index) => (
                      <div
                        key={image.id ?? index}
                        className="relative aspect-square rounded-lg overflow-hidden bg-muted"
                      >
                        {/* CLS-FIX: use next/image fill so the browser never
                            needs to compute intrinsic dimensions; the parent
                            aspect-square container pre-reserves all the space. */}
                        <Image
                          src={image.url || "/placeholder.svg"}
                          alt={`Photo ${index + 1}`}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 flex items-center gap-1">
                          {index === 0 && (
                            <span className="text-[10px] bg-primary text-primary-foreground px-1 rounded">
                              Main
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-1 right-1 flex gap-1">
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
                    ))}
                    {images.length < 12 && (
                      <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground mt-1">Add</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {listingType === "used" || listingType === "board"
                      ? "Minimum 3 photos required, maximum 12. Only vertical (portrait) photos — height greater than width. First image is the main photo. Any common phone/camera format is OK; unsupported types are converted to JPEG automatically."
                      : "Only vertical (portrait) photos — height greater than width. First image is the main photo. Any common phone/camera format is OK; unsupported types are converted to JPEG automatically."}
                  </p>
                  {(listingType === "used" || listingType === "board") && images.length > 0 && images.length < 3 && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Add {3 - images.length} more photo{3 - images.length !== 1 ? "s" : ""} to meet the minimum (3 required).
                    </p>
                  )}
                </div>

                {/* Submit */}
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editId ? "Saving..." : "Creating Listing..."}
                    </>
                  ) : (
                    editId ? "Save changes" : "Create Listing"
                  )}
                </Button>
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
