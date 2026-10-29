"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Palmtree, Sun } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  getShopVacationStatusAction,
  setShopVacationModeAction,
} from "@/lib/actions/shopVacationMode"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"
import {
  shopVacationButtonMode,
  shopVacationTargetIds,
  type ShopVacationListing,
} from "@/lib/shop-vacation"
import { cn } from "@/lib/utils"

interface ShopVacationButtonProps {
  /** When omitted, status loads from the profile/shop vacation action. */
  listings?: ShopVacationListing[]
  className?: string
  onComplete?: (vacationMode: boolean) => void
}

export function ShopVacationButton({ listings: listingsProp, className, onComplete }: ShopVacationButtonProps) {
  const router = useRouter()
  const [listings, setListings] = useState<ShopVacationListing[] | null>(listingsProp ?? null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (listingsProp) {
      setListings(listingsProp)
      return
    }
    const result = await getShopVacationStatusAction()
    if ("error" in result) {
      setLoadError(result.error)
      setListings([])
      return
    }
    setLoadError(null)
    setListings(result.listings)
  }, [listingsProp])

  useEffect(() => {
    if (listingsProp) {
      setListings(listingsProp)
      return
    }
    void reload()
  }, [listingsProp, reload])

  const mode = listings == null ? "unavailable" : shopVacationButtonMode(listings)
  const turningOn = mode !== "off"
  const targetCount = mode === "unavailable" || !listings ? 0 : shopVacationTargetIds(listings, mode).length
  const loading = listings == null && !loadError

  async function confirm() {
    if (busy || mode === "unavailable") return
    setBusy(true)
    try {
      const result = await setShopVacationModeAction({ vacationMode: turningOn })
      if ("error" in result) {
        toast.error(sellActionErrorMessage(result.error))
        return
      }
      if (result.updated === 0) {
        toast.message(turningOn ? "Your live listings are already on vacation." : "Your shop is already live.")
      } else {
        toast.success(
          turningOn
            ? result.updated === 1
              ? "Vacation mode is on for 1 listing."
              : `Vacation mode is on for ${result.updated} listings.`
            : result.updated === 1
              ? "1 listing is live again."
              : `${result.updated} listings are live again.`,
        )
      }
      if (result.failed > 0) {
        toast.message(`${result.failed} listing${result.failed === 1 ? "" : "s"} could not be updated.`)
      }
      onComplete?.(turningOn)
      setOpen(false)
      await reload()
      router.refresh()
    } catch {
      toast.error("Could not update vacation mode.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "rounded-full",
          turningOn
            ? "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200"
            : "border-border",
          className,
        )}
        disabled={loading || mode === "unavailable" || busy}
        title={
          loadError
            ? loadError
            : mode === "unavailable"
              ? "No live listings to pause"
              : undefined
        }
        onClick={() => setOpen(true)}
      >
        {busy || loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : turningOn ? (
          <Palmtree className="h-3.5 w-3.5" />
        ) : (
          <Sun className="h-3.5 w-3.5" />
        )}
        {turningOn ? "Turn shop on vacation" : "End shop vacation"}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {turningOn ? "Turn your shop on vacation?" : "Bring your shop back?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {turningOn
                ? `This hides ${targetCount === 1 ? "your live listing" : `all ${targetCount} live listings`} from browse, search, and checkout. Drafts and sold listings stay as they are. You can bring the shop back from Profile.`
                : `This puts ${targetCount === 1 ? "the listing you paused" : `${targetCount} listings you paused`} back on the site. Listings hidden by Reswell stay hidden.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={busy} onClick={() => void confirm()}>
              {busy ? "Updating…" : turningOn ? "Turn shop on vacation" : "End shop vacation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
