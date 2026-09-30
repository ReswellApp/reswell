"use client"

import { useState } from "react"
import { emailImageSrc } from "@/lib/email-studio/email-image-url"
import { uploadBlogMediaFile } from "@/lib/blog/upload-blog-media"

export function EmailImageFrame({
  src,
  alt,
  width,
  height,
  maxWidth,
  radius,
  selected,
  onChange,
}: {
  src: string
  alt: string
  width: number
  height: number | null
  maxWidth: number
  radius?: number
  selected: boolean
  onChange: (patch: { src?: string; alt?: string; width?: number; height?: number | null }) => void
}) {
  const [uploading, setUploading] = useState(false)

  async function onFile(file: File) {
    setUploading(true)
    const uploaded = await uploadBlogMediaFile(file)
    setUploading(false)
    if (uploaded?.url) onChange({ src: emailImageSrc(uploaded.url) })
  }

  function dragWidth(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const start = width
    function move(ev: PointerEvent) {
      const next = Math.min(maxWidth, Math.max(40, Math.round(start + ev.clientX - startX)))
      onChange({ width: next })
    }
    function up() {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  function dragHeight(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    const startY = event.clientY
    const start = height ?? 180
    function move(ev: PointerEvent) {
      const next = Math.min(800, Math.max(40, Math.round(start + ev.clientY - startY)))
      onChange({ height: next })
    }
    function up() {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <div className="space-y-2">
      <div className="relative inline-block max-w-full" style={{ width }}>
        <div
          className="block overflow-hidden border border-dashed border-[#E2E8F0] bg-[#F9F9F2]"
          style={{ borderRadius: radius ?? 8 }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files[0]
            if (file) void onFile(file)
          }}
        >
          {src ? (
            // Stored /media and library URLs are arbitrary hosts; the email uses the same src.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              className="block w-full"
              style={height ? { height, objectFit: "cover", objectPosition: "center" } : { height: "auto" }}
            />
          ) : (
            <span className="block px-3 py-10 text-center text-xs text-[#64748B]">
              {uploading ? "Uploading…" : "Drop an image"}
            </span>
          )}
        </div>
        {selected ? (
          <>
            <button
              type="button"
              aria-label="Drag to scale width"
              className="absolute -right-1.5 top-1/2 h-10 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border border-[#7C5CFC] bg-white"
              onPointerDown={dragWidth}
            />
            <button
              type="button"
              aria-label="Drag to crop height"
              className="absolute -bottom-1.5 left-1/2 h-3 w-10 -translate-x-1/2 cursor-ns-resize rounded-full border border-[#7C5CFC] bg-white"
              onPointerDown={dragHeight}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}
