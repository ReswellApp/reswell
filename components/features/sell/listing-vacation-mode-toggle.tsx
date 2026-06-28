"use client"

import { useEffect, useState } from "react"
import { Loader2, Palmtree } from "lucide-react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { setListingVacationModeAction } from "@/lib/actions/listingVacationMode"

type ListingVacationModeToggleProps = {
  listingId: string
  initialVacationMode: boolean
  disabled?: boolean
  onVacationModeChange?: (enabled: boolean) => void
}

export function ListingVacationModeToggle({
  listingId,
  initialVacationMode,
  disabled = false,
  onVacationModeChange,
}: ListingVacationModeToggleProps) {
  const [vacationMode, setVacationMode] = useState(initialVacationMode)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setVacationMode(initialVacationMode)
  }, [initialVacationMode])

  async function handleCheckedChange(checked: boolean) {
    if (busy || disabled) return

    const previous = vacationMode
    setVacationMode(checked)
    setBusy(true)

    try {
      const result = await setListingVacationModeAction({
        listingId,
        vacationMode: checked,
      })
      if ("error" in result) {
        setVacationMode(previous)
        toast.error(result.error)
        return
      }
      onVacationModeChange?.(checked)
      toast.success(
        checked
          ? "Vacation mode on — listing hidden from the site"
          : "Vacation mode off — listing is live again",
      )
    } catch {
      setVacationMode(previous)
      toast.error("Could not update vacation mode")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex gap-4">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"
          aria-hidden
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Palmtree className="h-4 w-4" strokeWidth={2.25} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <Label
              htmlFor={`listing-vacation-mode-${listingId}`}
              className="cursor-pointer text-sm font-medium text-foreground"
            >
              Vacation mode
            </Label>
            <p className="text-sm leading-relaxed text-muted-foreground/45">
              Hide this listing from browse, search, and public pages while you&apos;re away. Your
              listing stays saved — turn vacation mode off when you&apos;re ready to sell again.
            </p>
          </div>
          <Switch
            id={`listing-vacation-mode-${listingId}`}
            checked={vacationMode}
            onCheckedChange={(v) => void handleCheckedChange(v === true)}
            disabled={disabled || busy}
            className="mt-0.5 shrink-0 data-[state=checked]:bg-listingHeart"
            aria-label="Vacation mode"
          />
        </div>
      </div>
    </div>
  )
}
