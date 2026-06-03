"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { seoMediaDisplaySrc } from "@/lib/public-media-display-src"
import { uploadSeoImageFile } from "@/lib/seo/upload-seo-image-client"

interface SeoImageFieldProps {
  label: string
  helpText?: string
  value: string
  onChange: (url: string | null) => void
}

export function SeoImageField({ label, helpText, value, onChange }: SeoImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [showUrl, setShowUrl] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadSeoImageFile(file)
      if (url) onChange(url)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-foreground">{label}</Label>
        <button
          type="button"
          onClick={() => setShowUrl((v) => !v)}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {showUrl ? "Hide URL" : "Paste URL"}
        </button>
      </div>

      <div className="flex items-start gap-3">
        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
          {value ? (
            <Image
              src={seoMediaDisplaySrc(value)}
              alt=""
              fill
              sizes="128px"
              className="object-cover"
              unoptimized={listingImageShouldBypassOptimization(seoMediaDisplaySrc(value))}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" aria-hidden />
              )}
              {value ? "Replace image" : "Upload image"}
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange(null)}>
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
          {helpText ? <p className="text-[11px] text-muted-foreground">{helpText}</p> : null}
        </div>
      </div>

      {showUrl ? (
        <Input
          value={value}
          placeholder="https://… (1200×630 recommended)"
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className="font-mono text-xs"
        />
      ) : null}
    </div>
  )
}
