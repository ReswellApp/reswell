"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  applyListingPhotoToneToPixels,
  type ListingPhotoTone,
} from "@/lib/utils/listing-photo-tone"

const PREVIEW_MAX_EDGE = 960

type ListingPhotoToneCanvasProps = {
  src: string
  tone: ListingPhotoTone
  className?: string
  onNaturalSize?: (size: { w: number; h: number }) => void
}

export function ListingPhotoToneCanvas({
  src,
  tone,
  className,
  onNaturalSize,
}: ListingPhotoToneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<ImageData | null>(null)
  const toneRef = useRef(tone)
  const onNaturalSizeRef = useRef(onNaturalSize)
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")
  toneRef.current = tone
  onNaturalSizeRef.current = onNaturalSize

  function paint(next: ListingPhotoTone) {
    const frame = frameRef.current
    const canvas = canvasRef.current
    if (!frame || !canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (canvas.width !== frame.width || canvas.height !== frame.height) {
      canvas.width = frame.width
      canvas.height = frame.height
    }
    const pixels = new Uint8ClampedArray(frame.data)
    applyListingPhotoToneToPixels(pixels, 4, next)
    ctx.putImageData(new ImageData(pixels, frame.width, frame.height), 0, 0)
  }

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    frameRef.current = null
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      if (cancelled) return
      const longEdge = Math.max(img.naturalWidth, img.naturalHeight)
      const scale = longEdge > PREVIEW_MAX_EDGE ? PREVIEW_MAX_EDGE / longEdge : 1
      const width = Math.max(1, Math.round(img.naturalWidth * scale))
      const height = Math.max(1, Math.round(img.naturalHeight * scale))
      const scratch = document.createElement("canvas")
      scratch.width = width
      scratch.height = height
      const ctx = scratch.getContext("2d", { willReadFrequently: true })
      if (!ctx) {
        setStatus("failed")
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        frameRef.current = ctx.getImageData(0, 0, width, height)
      } catch {
        setStatus("failed")
        return
      }
      onNaturalSizeRef.current?.({ w: img.naturalWidth, h: img.naturalHeight })
      paint(toneRef.current)
      setStatus("ready")
    }
    img.onerror = () => {
      if (!cancelled) setStatus("failed")
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    if (status !== "ready") return
    const frame = requestAnimationFrame(() => paint(tone))
    return () => cancelAnimationFrame(frame)
  }, [status, tone])

  return (
    <div className={cn("absolute inset-0", className)}>
      <canvas ref={canvasRef} className="h-full w-full object-contain" />
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-white/50" aria-hidden />
        </div>
      ) : null}
      {status === "failed" ? (
        <p className="absolute inset-x-4 bottom-4 text-center text-[13px] text-white/70">
          Live preview is unavailable. Saving still updates the listing photo.
        </p>
      ) : null}
    </div>
  )
}
