"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { ArrowLeft, Upload, Loader2, X } from "lucide-react"
import { LocationPicker } from "@/components/location-picker"

// Category slugs mapped to DB UUIDs
const categories = [
  { value: "2744c29e-d6d4-43d9-a3ee-5bc11a0027df", label: "Wetsuits" },
  { value: "f8327e72-d54c-4333-b383-58a8cef225a6", label: "Fins" },
  { value: "b2a6282c-4c23-42dc-83f4-492eaa4f993a", label: "Leashes" },
  { value: "bfb243e2-98c3-4918-a8b7-68d94f123ccc", label: "Traction Pads" },
  { value: "3779de38-dcf8-430f-a42c-9a17a2e048c4", label: "Board Bags" },
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

export default function SellPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [listingType, setListingType] = useState<"used" | "board">("used")
  const [images, setImages] = useState<File[]>([])
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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      if (images.length + newFiles.length > 5) {
        toast.error("Maximum 5 images allowed")
        return
      }
      setImages([...images, ...newFiles])
    }
  }

  function removeImage(index: number) {
    setImages(images.filter((_, i) => i !== index))
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

      // Validate required fields
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

      // Upload images
      const imageUrls: string[] = []
      for (const image of images) {
        const fileName = `${user.id}/${Date.now()}-${image.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("listings")
          .upload(fileName, image)

        if (uploadError) {
          console.error("Upload error:", uploadError)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from("listings")
          .getPublicUrl(uploadData.path)
        
        imageUrls.push(publicUrl)
      }

      // Create listing
      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .insert({
          user_id: user.id,
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price),
          condition: formData.condition,
          section: listingType,
          category_id: listingType === "used" ? formData.category : boardCategoryMap[formData.boardType] || boardCategoryMap.other,
          board_type: listingType === "board" ? formData.boardType : null,
          length_feet: listingType === "board" && formData.boardLength ? parseInt(formData.boardLength.split("'")[0]) : null,
      length_inches: listingType === "board" && formData.boardLength ? parseInt(formData.boardLength.split("'")[1] || "0") : null,
          latitude: listingType === "board" && formData.locationLat ? formData.locationLat : null,
          longitude: listingType === "board" && formData.locationLng ? formData.locationLng : null,
          city: listingType === "board" ? formData.locationCity : null,
          state: listingType === "board" ? formData.locationState : null,
          shipping_available: listingType === "used" ? formData.allowsShipping : false,
          status: "active",
        })
        .select()
        .single()

      if (listingError) throw listingError

      // Add images
      if (imageUrls.length > 0) {
        const imageRecords = imageUrls.map((url, index) => ({
          listing_id: listing.id,
          url: url,
          is_primary: index === 0,
          sort_order: index,
        }))

        const { error: imgError } = await supabase.from("listing_images").insert(imageRecords)
        if (imgError) {
          console.error("Error inserting images:", imgError.message)
        }
      }

      toast.success("Listing created successfully!")
      router.push(`/${listingType === "board" ? "boards" : "used"}/${listing.id}`)
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
              <CardTitle>Create a Listing</CardTitle>
              <CardDescription>
                Sell your surf gear to the community
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                      <Label htmlFor="boardLength">Board Length</Label>
                      <Input
                        id="boardLength"
                        placeholder={`e.g., 6'2"`}
                        value={formData.boardLength}
                        onChange={(e) => setFormData({ ...formData, boardLength: e.target.value })}
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
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your item - include details about size, wear, included accessories, etc."
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                        <img
                          src={URL.createObjectURL(image) || "/placeholder.svg"}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {index === 0 && (
                          <span className="absolute bottom-1 left-1 text-xs bg-primary text-primary-foreground px-1 rounded">
                            Main
                          </span>
                        )}
                      </div>
                    ))}
                    {images.length < 5 && (
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
                    First image will be the main photo. Drag to reorder.
                  </p>
                </div>

                {/* Submit */}
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Listing...
                    </>
                  ) : (
                    "Create Listing"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
