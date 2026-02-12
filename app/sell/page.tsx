"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
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
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { ArrowLeft, Upload, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react"
import { LocationPicker } from "@/components/location-picker"

// Used gear categories (ids match public.categories). Hardware & Accessories and Travel & Storage removed from used section.
const categories = [
  { value: "2744c29e-d6d4-43d9-a3ee-5bc11a0027df", label: "Wetsuits" },
  { value: "f8327e72-d54c-4333-b383-58a8cef225a6", label: "Fins" },
  { value: "b2a6282c-4c23-42dc-83f4-492eaa4f993a", label: "Leashes" },
  { value: "a5000005-0000-4000-8000-000000000005", label: "Traction Pads" },
  { value: "3779de38-dcf8-430f-a42c-9a17a2e048c4", label: "Board Bags" },
  { value: "a6000006-0000-4000-8000-000000000006", label: "Backpacks" },
  { value: "a2000002-0000-4000-8000-000000000002", label: "Apparel & Lifestyle" },
  { value: "a3000003-0000-4000-8000-000000000003", label: "Collectibles & Vintage" },
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

export default function SellPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const editId = searchParams.get("edit")

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
    allowsShipping: true,
    boardType: "",
    boardLength: "",
    locationLat: 0,
    locationLng: 0,
    locationCity: "",
    locationState: "",
    locationDisplay: "",
  })

  useEffect(() => {
    if (!editId) {
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
      const { data: listing, error } = await supabase
        .from("listings")
        .select("*, listing_images(id, url, is_primary, sort_order)")
        .eq("id", editId)
        .eq("user_id", user.id)
        .single()
      if (!mounted) return
      if (error || !listing) {
        toast.error("Listing not found or cannot be edited")
        router.replace("/sell")
        setEditLoading(false)
        return
      }
      const section = listing.section === "surfboards" ? "board" : (listing.section as "used")
      setListingType(section)
      const lengthFeet = listing.length_feet != null ? String(listing.length_feet) : ""
      const lengthInches = listing.length_inches != null ? String(listing.length_inches) : ""
      setFormData({
        title: listing.title ?? "",
        description: listing.description ?? "",
        price: String(listing.price ?? ""),
        category: listing.category_id ?? "",
        condition: listing.condition ?? "",
        allowsShipping: !!listing.shipping_available,
        boardType: listing.board_type ?? "",
        boardLength: lengthFeet && lengthInches ? `${lengthFeet}'${lengthInches}"` : "",
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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    const newFiles = Array.from(e.target.files)
    if (images.length + newFiles.length > 5) {
      toast.error("Maximum 5 images allowed (including existing photos)")
      return
    }
    const next: EditableImage[] = []
    for (const file of newFiles) {
      next.push({
        file,
        url: URL.createObjectURL(file),
      })
    }
    setImages((prev) => [...prev, ...next])
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

  /** Convert HEIC/HEIF to JPEG so Supabase Storage accepts it; pass through other image types. */
  async function toUploadableImage(file: File): Promise<File> {
    const type = (file.type || "").toLowerCase()
    if (type === "image/heic" || type === "image/heif" || /\.heic$/i.test(file.name)) {
      try {
        const heic2any = (await import("heic2any")).default
        const blob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        })
        const jpegBlob = Array.isArray(blob) ? blob[0] : blob
        const name = file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg")
        return new File([jpegBlob as Blob], name, { type: "image/jpeg" })
      } catch (err) {
        console.error("HEIC conversion failed:", err)
        toast.error("Could not convert HEIC image. Try using a JPEG or PNG instead.")
        throw err
      }
    }
    return file
  }

  async function syncListingImages(listingId: string, userId: string) {
    // Delete removed existing images
    if (removedImageIds.length) {
      await supabase
        .from("listing_images")
        .delete()
        .in("id", removedImageIds)
        .eq("listing_id", listingId)
    }

    // Upsert / insert images in current order
    for (let index = 0; index < images.length; index++) {
      const img = images[index]
      const isPrimary = index === 0

      if (img.id) {
        await supabase
          .from("listing_images")
          .update({
            sort_order: index,
            is_primary: isPrimary,
          })
          .eq("id", img.id)
          .eq("listing_id", listingId)
      } else if (img.file) {
        let fileToUpload: File
        try {
          fileToUpload = await toUploadableImage(img.file)
        } catch {
          continue
        }
        const baseName = fileToUpload.name.replace(/\.[^.]+$/i, "") || "image"
        const ext =
          fileToUpload.type === "image/png"
            ? "png"
            : fileToUpload.type === "image/webp"
            ? "webp"
            : "jpg"
        const fileName = `${userId}/${Date.now()}-${index}-${baseName}.${ext}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("listings")
          .upload(fileName, fileToUpload, {
            contentType: fileToUpload.type,
            upsert: false,
          })

        if (uploadError) {
          console.error("Upload error:", uploadError)
          toast.error(`Photo ${index + 1} failed to upload: ${uploadError.message}`)
          continue
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("listings").getPublicUrl(uploadData.path)

        await supabase.from("listing_images").insert({
          listing_id: listingId,
          url: publicUrl,
          is_primary: isPrimary,
          sort_order: index,
        })
      }
    }
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

      let listingId = editId

      if (editId) {
        const { error: updateError } = await supabase
          .from("listings")
          .update({
            title: formData.title,
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
            latitude: listingType === "board" && formData.locationLat ? formData.locationLat : null,
            longitude:
              listingType === "board" && formData.locationLng ? formData.locationLng : null,
            city: listingType === "board" ? formData.locationCity : null,
            state: listingType === "board" ? formData.locationState : null,
            shipping_available: listingType === "used" ? formData.allowsShipping : false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editId)
          .eq("user_id", user.id)
        if (updateError) throw updateError
      } else {
        const { data: listing, error: listingError } = await supabase
          .from("listings")
          .insert({
            user_id: user.id,
            title: formData.title,
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
            latitude: listingType === "board" && formData.locationLat ? formData.locationLat : null,
            longitude:
              listingType === "board" && formData.locationLng ? formData.locationLng : null,
            city: listingType === "board" ? formData.locationCity : null,
            state: listingType === "board" ? formData.locationState : null,
            shipping_available: listingType === "used" ? formData.allowsShipping : false,
            status: "active",
          })
          .select()
          .single()

        if (listingError || !listing) throw listingError
        listingId = listing.id
      }

      if (listingId) {
        await syncListingImages(listingId, user.id)
      }

      toast.success(editId ? "Listing updated" : "Listing created successfully!")
      const sectionPath = listingType === "board" ? "boards" : "used"
      router.push(`/${sectionPath}/${listingId}`)
    } catch (error: any) {
      console.error("Error creating listing:", error?.message || error)
      toast.error(error?.message || "Failed to create listing")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
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
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setListingType("used")}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        listingType === "used"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium">Used Accessories</p>
                      <p className="text-sm text-muted-foreground">
                        Wetsuits, fins, leashes, etc.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingType("board")}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        listingType === "board"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium">Surfboard</p>
                      <p className="text-sm text-muted-foreground">
                        In-person pickup only
                      </p>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., O'Neill 3/2 Wetsuit - Size M"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                {/* Category or Board Type */}
                {listingType === "used" ? (
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
                ) : (
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
                )}

                {/* Location Picker (surfboards only) */}
                {listingType === "board" && (
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
                  />
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
                    Description{listingType === "board" ? " *" : ""}
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your item - include details about size, wear, included accessories, etc."
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required={listingType === "board"}
                  />
                </div>

                {/* Shipping (only for used items) */}
                {listingType === "used" && (
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label htmlFor="shipping" className="font-medium">
                        Offer Shipping
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow buyers to have this item shipped to them
                      </p>
                    </div>
                    <Switch
                      id="shipping"
                      checked={formData.allowsShipping}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, allowsShipping: checked })
                      }
                    />
                  </div>
                )}

                {/* Images */}
                <div className="space-y-2">
                  <Label>Photos (up to 5)</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {images.map((image, index) => (
                      <div
                        key={image.id ?? index}
                        className="relative aspect-square rounded-lg overflow-hidden bg-muted"
                      >
                        <img
                          src={image.url || "/placeholder.svg"}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover"
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
                    {images.length < 5 && (
                      <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground mt-1">Add</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                          multiple
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    First image is used as the main photo. You can remove photos or change their order; new
                    uploads will be saved in the order shown. JPG, PNG, WebP, and HEIC (iPhone) supported.
                  </p>
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

      <Footer />
    </div>
  )
}
