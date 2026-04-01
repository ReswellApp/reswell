"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { portraitShimmer, squareShimmer } from "@/lib/image-shimmer"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageGalleryProps {
  images: Array<{ id: string; url: string; is_primary: boolean }>
  title: string
  /** Sold listings: muted imagery + SOLD badge (no change to carousel behavior). */
  sold?: boolean
}

export function ImageGallery({ images, title, sold }: ImageGalleryProps) {
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
    <div className="space-y-4 w-full min-w-0 max-w-[370px] md:max-w-[450px] mx-auto">
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
            className={cn(
              "object-contain transition-opacity duration-300",
              sold && "[filter:grayscale(30%)]",
            )}
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            placeholder="blur"
            blurDataURL={portraitShimmer}
          />
        </div>
        {sold && (
          <>
            <div className="pointer-events-none absolute inset-0 z-[5] bg-black/[0.08]" aria-hidden />
            <div
              className="absolute left-3 top-3 z-20 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: "#111" }}
            >
              Sold
            </div>
          </>
        )}

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
                    className={cn("object-contain", sold && "[filter:grayscale(30%)]")}
                    sizes="64px"
                    placeholder="blur"
                    blurDataURL={squareShimmer}
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
