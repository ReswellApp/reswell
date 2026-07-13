"use client"

import { useRef } from "react"
import { ImagePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type ForumPhotoPickerProps = {
  previewUrl: string | null
  disabled?: boolean
  label?: string
  onSelect: (file: File) => void
  onClear: () => void
  className?: string
}

export function ForumPhotoPicker({
  previewUrl,
  disabled,
  label = "Photo (optional)",
  onSelect,
  onClear,
  className,
}: ForumPhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onSelect(file)
        }}
      />
      {previewUrl ? (
        <div className="relative inline-block max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Photo preview"
            className="max-h-48 max-w-full rounded-xl border border-border/60 object-contain"
          />
          <button
            type="button"
            aria-label="Remove photo"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-foreground"
            onClick={onClear}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Add a photo
        </Button>
      )}
    </div>
  )
}
