"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageGalleryProps {
  images: Array<{ id: string; url: string; is_primary: boolean }>
  title: string
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div
        className="relative w-full bg-muted rounded-lg text-muted-foreground"
        style={{ paddingBottom: "133.33%" }}
      >
        <span className="absolute inset-0 flex items-center justify-center">No images available</span>
      </div>
    )
  }

  const selectedImage = images[selectedIndex]

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Main Image - 3:4 ratio, show full image without cropping */}
      <div
        className="relative w-full rounded-lg overflow-hidden bg-muted"
        style={{ paddingBottom: "133.33%" }}
      >
        <div className="absolute inset-0">
          <Image
            src={selectedImage.url || "/placeholder.svg"}
            alt={`${title} - Image ${selectedIndex + 1}`}
            fill
            className="object-contain"
            style={{ objectFit: "contain" }}
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100 z-10"
              onClick={() => setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous image</span>
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100 z-10"
              onClick={() => setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next image</span>
            </Button>
          </>
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-sm z-10">
            {selectedIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails - explicit 3:4 box (padding-bottom) so fill Image has a defined size */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors bg-muted",
                index === selectedIndex
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-transparent hover:border-muted-foreground/50"
              )}
            >
              <span
                className="relative block w-16 bg-muted"
                style={{ paddingBottom: "133.33%" }}
              >
                <span className="absolute inset-0">
                  <Image
                    src={image.url || "/placeholder.svg"}
                    alt={`${title} - Thumbnail ${index + 1}`}
                    fill
                    className="object-contain"
                    style={{ objectFit: "contain" }}
                    sizes="64px"
                  />
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
