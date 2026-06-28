"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Palmtree, Sun } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { setListingVacationModeAction } from "@/lib/actions/listingVacationMode"
import { cn } from "@/lib/utils"

type ListingVacationModeButtonProps = {
  listingId: string
  vacationMode: boolean
  disabled?: boolean
  className?: string
  onVacationModeChange?: (enabled: boolean) => void
}

export function ListingVacationModeButton({
  listingId,
  vacationMode: initialVacationMode,
  disabled = false,
  className,
  onVacationModeChange,
}: ListingVacationModeButtonProps) {
  const [vacationMode, setVacationMode] = useState(initialVacationMode)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setVacationMode(initialVacationMode)
  }, [initialVacationMode])

  async function handleClick() {
    if (busy || disabled) return

    const next = !vacationMode
    const previous = vacationMode
    setVacationMode(next)
    setBusy(true)

    try {
      const result = await setListingVacationModeAction({
        listingId,
        vacationMode: next,
      })
      if ("error" in result) {
        setVacationMode(previous)
        toast.error(result.error)
        return
      }
      onVacationModeChange?.(next)
      router.refresh()
      toast.success(
        next
          ? "Vacation mode on — listing hidden from the site"
          : "Listing is live again",
      )
    } catch {
      setVacationMode(previous)
      toast.error("Could not update vacation mode")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={vacationMode ? "default" : "outline"}
      disabled={disabled || busy}
      onClick={() => void handleClick()}
      className={cn(
        "min-w-[5.5rem] rounded-full shadow-none",
        vacationMode
          ? "bg-amber-600 text-white hover:bg-amber-600/90 dark:bg-amber-600 dark:hover:bg-amber-600/90"
          : "border-amber-500/40 text-amber-800 hover:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15",
        className,
      )}
      aria-pressed={vacationMode}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : vacationMode ? (
        <>
          <Sun className="h-3.5 w-3.5" />
          Go live
        </>
      ) : (
        <>
          <Palmtree className="h-3.5 w-3.5" />
          Vacation
        </>
      )}
    </Button>
  )
}

export function canUseListingVacationMode(status: string | null | undefined): boolean {
  const normalized = status?.trim() ?? ""
  return normalized === "active" || normalized === "pending_sale"
}
