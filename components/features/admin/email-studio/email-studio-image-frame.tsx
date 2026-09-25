"use client"

import { useState } from "react"
import { listEmailLibraryImagesAction } from "@/lib/actions/emailStudio"
import { emailImageSrc } from "@/lib/email-studio/email-image-url"
import { uploadBlogMediaFile } from "@/lib/blog/upload-blog-media"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function EmailImageFrame({
  src,
  alt,
  width,
  height,
  maxWidth,
  selected,
  onChange,
}: {
  src: string
  alt: string
  width: number
  height: number | null
  maxWidth: number
  selected: boolean
  onChange: (patch: { src?: string; alt?: string; width?: number; height?: number | null }) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [library, setLibrary] = useState<
    { id: string; label: string; src: string; group: "Blog" | "Listing" }[] | null
  >(null)
  const [libraryError, setLibraryError] = useState("")
  const [query, setQuery] = useState("")

  async function onFile(file: File) {
    setUploading(true)
    const uploaded = await uploadBlogMediaFile(file)
    setUploading(false)
    if (uploaded?.url) onChange({ src: emailImageSrc(uploaded.url) })
  }

  async function openLibrary() {
    if (library) return
    const result = await listEmailLibraryImagesAction()
    if ("error" in result) {
      setLibraryError(result.error)
      setLibrary([])
      return
    }
    setLibrary(result.data)
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

  const shown = library?.filter((item) => {
    const q = query.trim().toLowerCase()
    return !q || item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
      <div className="relative inline-block max-w-full" style={{ width }}>
        <label
          className="block cursor-pointer overflow-hidden rounded-lg border border-dashed border-[#E2E8F0] bg-[#F4F6F8]"
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
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void onFile(file)
            }}
          />
        </label>
        {selected ? (
          <>
            <button
              type="button"
              aria-label="Drag to scale width"
              className="absolute -right-1.5 top-1/2 h-10 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border border-[#5574AD] bg-white"
              onPointerDown={dragWidth}
            />
            <button
              type="button"
              aria-label="Drag to crop height"
              className="absolute -bottom-1.5 left-1/2 h-3 w-10 -translate-x-1/2 cursor-ns-resize rounded-full border border-[#5574AD] bg-white"
              onPointerDown={dragHeight}
            />
          </>
        ) : null}
      </div>
      {selected ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Width
            <Input
              type="number"
              min={40}
              max={maxWidth}
              value={width}
              onChange={(event) => onChange({ width: clamp(Number(event.target.value), 40, maxWidth, width) })}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Crop height
            <Input
              type="number"
              min={40}
              max={800}
              placeholder="Auto"
              value={height ?? ""}
              onChange={(event) => {
                const raw = event.target.value
                onChange({ height: raw === "" ? null : clamp(Number(raw), 40, 800, height ?? 180) })
              }}
            />
          </label>
          <div className="col-span-2">
            <Label className="text-xs">Saved images</Label>
            <Input
              value={query}
              placeholder="Search blog and listing photos"
              className="mt-1"
              onFocus={() => void openLibrary()}
              onChange={(event) => {
                setQuery(event.target.value)
                void openLibrary()
              }}
            />
            {libraryError ? <p className="mt-1 text-xs text-destructive">{libraryError}</p> : null}
            {shown && shown.length > 0 ? (
              <div className="mt-2 grid max-h-48 grid-cols-3 gap-1 overflow-y-auto">
                {shown.slice(0, 24).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="overflow-hidden rounded border border-border text-left"
                    title={item.label}
                    onClick={() => onChange({ src: item.src })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.src} alt="" className="h-16 w-full object-cover" />
                    <span className="block truncate px-1 py-0.5 text-[10px] text-muted-foreground">{item.group}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}
