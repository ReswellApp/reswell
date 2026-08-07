"use client"

import { useCallback, useRef } from "react"
import reswellLogoPng from "@/public/images/reswell-logo.png"
import { cn } from "@/lib/utils"

const VECTOR_SRC = "/images/reswell-logo.svg"
const VECTOR_FIRST = process.env.NEXT_PUBLIC_SITE_WORDMARK_USE_VECTOR_SVG === "true"
const PNG_SRC = typeof reswellLogoPng !== "string" ? reswellLogoPng.src : reswellLogoPng
const PNG_WIDTH = typeof reswellLogoPng !== "string" ? reswellLogoPng.width : undefined
const PNG_HEIGHT = typeof reswellLogoPng !== "string" ? reswellLogoPng.height : undefined

interface LiveChatWordmarkProps {
  className?: string
  /** White wordmark for the blue home header */
  onPrimary?: boolean
}

export function LiveChatWordmark({ className, onPrimary = false }: LiveChatWordmarkProps) {
  const swappedRef = useRef(false)

  const onRasterFallback = useCallback((event: { currentTarget: HTMLImageElement }) => {
    if (swappedRef.current) return
    swappedRef.current = true
    const el = event.currentTarget
    el.src = PNG_SRC
    const w = PNG_WIDTH ?? 996
    const h = PNG_HEIGHT ?? 137
    if (!el.width) el.width = w
    if (!el.height) el.height = h
  }, [])

  return (
    <img
      src={VECTOR_FIRST ? VECTOR_SRC : PNG_SRC}
      alt="Reswell"
      className={cn(
        "h-auto max-h-6 w-auto max-w-[9rem] object-contain object-left",
        onPrimary && "brightness-0 invert",
        className,
      )}
      width={PNG_WIDTH}
      height={PNG_HEIGHT}
      decoding="async"
      onError={VECTOR_FIRST ? onRasterFallback : undefined}
    />
  )
}
