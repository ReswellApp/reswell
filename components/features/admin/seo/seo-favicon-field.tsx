"use client"

import { useRef, useState } from "react"
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { uploadSeoIconFile } from "@/lib/seo/upload-seo-icon-client"

interface SeoFaviconFieldProps {
  label: string
  helpText?: string
  value: string
  onChange: (url: string | null) => void
}

/** Square icon uploader for favicons / app icons (PNG, SVG, ICO). */
export function SeoFaviconField({ label, helpText, value, onChange }: SeoFaviconFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadSeoIconFile(file)
      if (url) onChange(url)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      <div className="flex items-start gap-3">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/SVG icon URL, no optimization needed
            <img src={value} alt="" className="h-10 w-10 object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/webp"
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
              {value ? "Replace" : "Upload"}
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
    </div>
  )
}
