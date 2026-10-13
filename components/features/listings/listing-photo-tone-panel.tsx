"use client"

import { Slider } from "@/components/ui/slider"
import {
  LISTING_PHOTO_TONE_IDENTITY,
  LISTING_PHOTO_TONE_MAX,
  LISTING_PHOTO_TONE_MIN,
  isListingPhotoToneIdentity,
  type ListingPhotoTone,
} from "@/lib/utils/listing-photo-tone"

const STOPS: Array<{ key: keyof ListingPhotoTone; label: string }> = [
  { key: "brightness", label: "Brightness" },
  { key: "highlights", label: "Highlights" },
  { key: "shadows", label: "Shadows" },
  { key: "contrast", label: "Contrast" },
]

type ListingPhotoTonePanelProps = {
  tone: ListingPhotoTone
  disabled?: boolean
  onChange: (tone: ListingPhotoTone) => void
}

export function ListingPhotoTonePanel({ tone, disabled, onChange }: ListingPhotoTonePanelProps) {
  return (
    <div className="space-y-3">
      <p className="text-center text-[12px] font-medium uppercase tracking-[0.14em] text-white/45">
        Admin · updates the listing photos
      </p>
      {STOPS.map((stop) => {
        const value = tone[stop.key]
        return (
          <label
            key={stop.key}
            className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] items-center gap-3"
          >
            <span className="text-[13px] text-white/80">{stop.label}</span>
            <Slider
              min={LISTING_PHOTO_TONE_MIN}
              max={LISTING_PHOTO_TONE_MAX}
              step={1}
              value={[value]}
              disabled={disabled}
              onValueChange={([next]) => {
                if (typeof next !== "number") return
                onChange({ ...tone, [stop.key]: next })
              }}
              aria-label={stop.label}
              className="[&_[role=slider]]:size-5 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white [&_.bg-primary]:bg-white [&_.bg-secondary]:bg-white/20"
            />
            <span className="text-right text-[13px] tabular-nums text-white/70">
              {value > 0 ? `+${value}` : value}
            </span>
          </label>
        )
      })}
      <div className="flex justify-center">
        <button
          type="button"
          className="min-h-11 px-3 text-[13px] font-medium text-white/70 disabled:opacity-40"
          disabled={disabled || isListingPhotoToneIdentity(tone)}
          onClick={() => onChange({ ...LISTING_PHOTO_TONE_IDENTITY })}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
