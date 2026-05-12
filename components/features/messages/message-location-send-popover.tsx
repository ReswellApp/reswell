"use client"

import { useCallback, useId, useState } from "react"
import { Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"
import {
  GooglePlacesAddressInput,
  type GoogleFullPlaceResolved,
} from "@/components/features/checkout/google-places-address-input"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface MessageLocationSendPopoverProps {
  disabled?: boolean
  onSend: (place: GoogleFullPlaceResolved) => Promise<{ ok: boolean }>
}

export function MessageLocationSendPopover({
  disabled,
  onSend,
}: MessageLocationSendPopoverProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [resolved, setResolved] = useState<GoogleFullPlaceResolved | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [placesBroken, setPlacesBroken] = useState(false)

  const reset = useCallback(() => {
    setQuery("")
    setResolved(null)
    setPlacesBroken(false)
    setSubmitting(false)
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setPlacesBroken(false)
    }
    if (!next) {
      reset()
    }
  }

  const submit = async () => {
    if (!resolved || submitting) return
    setSubmitting(true)
    try {
      const { ok } = await onSend(resolved)
      if (ok) {
        handleOpenChange(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="mb-0.5 h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Send a location"
        >
          <MapPin className="h-[22px] w-[22px]" strokeWidth={2} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="z-[60] w-[min(22rem,calc(100vw-1.5rem))] space-y-3 p-4"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div>
          <p className="text-[15px] font-semibold leading-tight text-foreground">Send location</p>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            Search and pick a complete address from suggestions.
          </p>
        </div>
        {placesBroken ? (
          <p className="text-[13px] text-destructive">
            Address search is unavailable. Try again later or refresh the page.
          </p>
        ) : (
          <GooglePlacesAddressInput
            id={`${listId}-loc`}
            value={query}
            onChange={(v) => {
              setQuery(v)
              setResolved(null)
            }}
            onFullPlaceResolved={(place) => {
              setResolved(place)
            }}
            onProviderError={() => {
              setPlacesBroken(true)
              toast.error("Could not load Google Maps. Check your connection or try again.")
            }}
            placeholder="Street, city, ZIP…"
            inputClassName="h-11 rounded-xl border-border/80 bg-background text-[17px]"
            listboxId={`${listId}-msg-loc`}
            minLength={2}
            disabled={submitting}
          />
        )}
        <Button
          type="button"
          className="w-full rounded-xl"
          disabled={!resolved || submitting || placesBroken}
          onClick={() => void submit()}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            "Send pin"
          )}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
