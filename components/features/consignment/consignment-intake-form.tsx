"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import { Loader2, Upload, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"

const CONDITIONS = [
  { value: "brand_new", label: "Brand new" },
  { value: "excellent", label: "Excellent" },
  { value: "very_good", label: "Very good" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
] as const

const MAX_PHOTOS = 12

interface UploadedPhoto {
  url: string
  uploading: boolean
}

interface ConsignmentIntakeFormProps {
  storeId: string
  storeName: string
  userId: string
}

export function ConsignmentIntakeForm({ storeId, storeName, userId }: ConsignmentIntakeFormProps) {
  const router = useRouter()
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [condition, setCondition] = useState<string>("")
  const [boardType, setBoardType] = useState("")
  const [dimensions, setDimensions] = useState("")
  const [proposedPrice, setProposedPrice] = useState("")
  const [floorPrice, setFloorPrice] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const uploadingCount = photos.filter((p) => p.uploading).length

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const remaining = MAX_PHOTOS - photos.length
    const toUpload = Array.from(files).slice(0, remaining)
    if (toUpload.length === 0) {
      toast.error(`You can add up to ${MAX_PHOTOS} photos.`)
      return
    }

    const supabase = createClient()
    for (const file of toUpload) {
      const placeholderIndex = photos.length
      setPhotos((prev) => [...prev, { url: "", uploading: true }])
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
        const path = `${userId}/consign-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from("listings").upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        })
        if (error) throw error
        const {
          data: { publicUrl },
        } = supabase.storage.from("listings").getPublicUrl(path)
        setPhotos((prev) =>
          prev.map((p, i) => (i === placeholderIndex ? { url: publicUrl, uploading: false } : p)),
        )
      } catch {
        toast.error("Couldn't upload a photo. Try again.")
        setPhotos((prev) => prev.filter((_, i) => i !== placeholderIndex))
      }
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    const uploadedUrls = photos.filter((p) => !p.uploading && p.url).map((p) => p.url)
    if (uploadingCount > 0) {
      toast.error("Wait for photos to finish uploading.")
      return
    }
    if (uploadedUrls.length === 0) {
      toast.error("Add at least one photo.")
      return
    }
    if (!condition) {
      toast.error("Select a condition.")
      return
    }
    if (!termsAccepted) {
      toast.error("Accept the consignment terms to continue.")
      return
    }

    const proposed = parseFloat(proposedPrice)
    const floor = parseFloat(floorPrice)
    if (!Number.isFinite(proposed) || proposed <= 0) {
      toast.error("Enter a valid proposed price.")
      return
    }
    if (!Number.isFinite(floor) || floor <= 0) {
      toast.error("Enter a valid floor price.")
      return
    }
    if (floor > proposed) {
      toast.error("Floor price can't exceed your proposed price.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/consignment/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          title: title.trim(),
          description: description.trim(),
          condition,
          boardType: boardType.trim() || undefined,
          dimensions: dimensions.trim() || undefined,
          photoUrls: uploadedUrls,
          consignorProposedPrice: proposed,
          floorPrice: floor,
          termsAccepted: true,
        }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't submit your board. Try again.")
        return
      }
      toast.success("Board submitted! The shop will review and set the asking price.")
      setPhotos([])
      setTitle("")
      setDescription("")
      setCondition("")
      setBoardType("")
      setDimensions("")
      setProposedPrice("")
      setFloorPrice("")
      setTermsAccepted(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label className="mb-2 block">Photos</Label>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              {photo.uploading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <Image
                    src={photo.url}
                    alt={`Board photo ${index + 1}`}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label
              className={cn(
                "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition hover:border-foreground/40",
              )}
            >
              <Upload className="h-5 w-5" />
              <span className="text-xs">Add</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFiles(e.target.files)
                  e.target.value = ""
                }}
              />
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          First photo is the cover. Up to {MAX_PHOTOS} photos.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 6'2 Channel Islands Fishbeard"
          maxLength={140}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dings, repairs, ride notes, why you're letting it go…"
          rows={4}
          maxLength={4000}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Condition</Label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger>
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="boardType">Board type</Label>
          <Input
            id="boardType"
            value={boardType}
            onChange={(e) => setBoardType(e.target.value)}
            placeholder="Shortboard, fish, longboard…"
            maxLength={60}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dimensions">Dimensions</Label>
        <Input
          id="dimensions"
          value={dimensions}
          onChange={(e) => setDimensions(e.target.value)}
          placeholder={`e.g. 6'2" x 19 1/4" x 2 1/2", 32L`}
          maxLength={120}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="proposedPrice">Your proposed price</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="proposedPrice"
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              value={proposedPrice}
              onChange={(e) => setProposedPrice(e.target.value)}
              className="pl-7"
              placeholder="650"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="floorPrice">Floor price (lowest you'll accept)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="floorPrice"
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              value={floorPrice}
              onChange={(e) => setFloorPrice(e.target.value)}
              className="pl-7"
              placeholder="525"
              required
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        The shop sets the public asking price (at or above your proposed price) and can negotiate
        down to your floor — never below it without calling you.
      </p>

      <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          I authorize <span className="font-medium">{storeName}</span> to consign and sell this
          board on my behalf. The shop and Reswell take their agreed cut at sale; I receive the rest
          to my wallet once I complete payout setup.
        </span>
      </label>

      <Button type="submit" className="w-full" disabled={submitting || uploadingCount > 0}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          "Submit to shop"
        )}
      </Button>
    </form>
  )
}
