"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MarkSoldFollowUp } from "@/components/features/listings/mark-sold-follow-up"
import { canUseListingVacationMode } from "@/components/features/sell/listing-vacation-mode-button"
import { toast } from "sonner"
import { setListingVacationModeAction } from "@/lib/actions/listingVacationMode"
import { postEndListing } from "@/lib/listing-end-request"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"
import { prefetchSaleTipCheckout } from "@/lib/stripe/prefetch-sale-tip-checkout"
import { cn } from "@/lib/utils"

type EndChoice = "delete" | "archive" | "mark_sold" | "vacation" | null
type DialogStep = "main" | "sold_survey"

export type EndListingDialogResult =
  | { mode: "archive"; message?: string }
  | { mode: "delete" }
  | { mode: "mark_sold" }
  | { mode: "vacation"; vacationMode: boolean }

interface EndListingDialogProps {
  listingId: string | null
  listingPriceUsd?: number
  listingStatus?: string | null
  vacationMode?: boolean
  canDelete?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (result: EndListingDialogResult) => void
}

export function EndListingDialog({
  listingId,
  listingPriceUsd,
  listingStatus,
  vacationMode = false,
  canDelete = false,
  open,
  onOpenChange,
  onComplete,
}: EndListingDialogProps) {
  const [step, setStep] = useState<DialogStep>("main")
  const [choice, setChoice] = useState<EndChoice>(null)
  const [loading, setLoading] = useState(false)
  const [soldPriceUsd, setSoldPriceUsd] = useState<number | null>(null)
  const [tipCheckoutActive, setTipCheckoutActive] = useState(false)
  const markedSoldRef = useRef(false)
  const tipCheckoutActiveRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    void prefetchSaleTipCheckout()
  }, [open])

  function resetState() {
    setStep("main")
    setChoice(null)
    setLoading(false)
    setSoldPriceUsd(null)
    setTipCheckoutActive(false)
    tipCheckoutActiveRef.current = false
  }

  function closeAndRefreshIfSold() {
    const sold = markedSoldRef.current
    resetState()
    markedSoldRef.current = false
    onOpenChange(false)
    if (sold) {
      toast.success("Listing marked as sold")
      onComplete?.({ mode: "mark_sold" })
      router.refresh()
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      closeAndRefreshIfSold()
      return
    }
    onOpenChange(true)
  }

  function handleCheckoutActiveChange(active: boolean) {
    tipCheckoutActiveRef.current = active
    setTipCheckoutActive(active)
  }

  async function handleConfirm() {
    if (!listingId || !choice) return

    if (choice === "vacation") {
      setLoading(true)
      try {
        const nextVacation = !vacationMode
        const result = await setListingVacationModeAction({
          listingId,
          vacationMode: nextVacation,
        })
        if ("error" in result) {
          toast.error(sellActionErrorMessage(result.error))
          return
        }
        toast.success(
          nextVacation
            ? "Vacation mode on — listing hidden from the site"
            : "Listing is live again",
        )
        onComplete?.({ mode: "vacation", vacationMode: nextVacation })
        resetState()
        onOpenChange(false)
        router.refresh()
      } finally {
        setLoading(false)
      }
      return
    }

    if (choice === "mark_sold") {
      setSoldPriceUsd(
        typeof listingPriceUsd === "number" && listingPriceUsd > 0 ? listingPriceUsd : null,
      )
      setStep("sold_survey")
      return
    }

    if (choice === "delete" && !canDelete) return

    setLoading(true)
    try {
      const result = await postEndListing(listingId, choice)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      if (result.mode === "delete") {
        onComplete?.({ mode: "delete" })
        closeAndRefreshIfSold()
        router.push("/dashboard/listings")
        return
      }

      onComplete?.({ mode: "archive", message: result.message })
      closeAndRefreshIfSold()
      router.push("/dashboard/listings/archived")
    } finally {
      setLoading(false)
    }
  }

  const followUpPriceUsd =
    soldPriceUsd ??
    (typeof listingPriceUsd === "number" && listingPriceUsd > 0 ? listingPriceUsd : null)
  const followUpOpen = step === "sold_survey"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          followUpOpen
            ? [
                "left-0 top-0 flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-3 overflow-hidden overscroll-none rounded-none",
                "p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
                "sm:left-[50%] sm:top-[50%] sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:p-5",
                tipCheckoutActive
                  ? "sm:h-[min(48rem,calc(100dvh-2rem))] sm:max-h-[calc(100dvh-2rem)]"
                  : "sm:h-[min(40rem,calc(100dvh-2rem))] sm:max-h-[calc(100dvh-2rem)]",
              ]
            : "max-h-[90vh] overflow-y-auto sm:max-w-lg",
        )}
        showCloseButton
        onOpenAutoFocus={(event) => {
          if (followUpOpen) event.preventDefault()
        }}
        onFocusOutside={(event) => {
          if (followUpOpen) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (followUpOpen) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (followUpOpen) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          if (followUpOpen) event.preventDefault()
        }}
      >
        {followUpOpen ? (
          <>
            <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
              <DialogTitle className="text-base">Congrats on the sale</DialogTitle>
              <DialogDescription className="text-xs">
                Where it sold, optional tip, and a rating.
              </DialogDescription>
            </DialogHeader>
            {listingId ? (
              <MarkSoldFollowUp
                listingId={listingId}
                listingPriceUsd={followUpPriceUsd}
                onCheckoutActiveChange={handleCheckoutActiveChange}
                onClose={closeAndRefreshIfSold}
                onMarkedSold={() => {
                  markedSoldRef.current = true
                }}
              />
            ) : null}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>End listing</DialogTitle>
              <DialogDescription>
                {canUseListingVacationMode(listingStatus)
                  ? "Vacation hides a live listing until you go live again. "
                  : null}
                Archive removes it from the public site and keeps it under Archived listings for 30
                days.
                {canDelete
                  ? " Delete removes the listing immediately."
                  : " This listing is tied to an order or payment, so it can be archived instead of deleted."}{" "}
                Mark as sold keeps it on file when you closed the sale elsewhere.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              {canUseListingVacationMode(listingStatus) ? (
                <Button
                  variant={choice === "vacation" ? "default" : "outline"}
                  className="justify-start"
                  type="button"
                  onClick={() => setChoice("vacation")}
                >
                  {vacationMode ? "Go live" : "Vacation mode"}
                </Button>
              ) : null}
              <Button
                variant={choice === "archive" ? "default" : "outline"}
                className="justify-start"
                type="button"
                onClick={() => setChoice("archive")}
              >
                Archive listing
              </Button>
              <Button
                variant={choice === "mark_sold" ? "default" : "outline"}
                className="justify-start"
                type="button"
                onClick={() => setChoice("mark_sold")}
              >
                Mark as sold
              </Button>
              {canDelete ? (
                <Button
                  variant={choice === "delete" ? "destructive" : "outline"}
                  className="justify-start"
                  type="button"
                  onClick={() => setChoice("delete")}
                >
                  Delete listing
                </Button>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={closeAndRefreshIfSold}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={choice === "delete" ? "destructive" : "default"}
                disabled={!choice || loading}
                onClick={() => void handleConfirm()}
              >
                {loading
                  ? choice === "delete"
                    ? "Deleting…"
                    : choice === "mark_sold"
                      ? "Continue"
                      : choice === "vacation"
                        ? vacationMode
                          ? "Going live…"
                          : "Updating…"
                        : "Archiving…"
                  : choice === "delete"
                    ? "Delete listing"
                    : choice === "archive"
                      ? "Archive listing"
                      : choice === "mark_sold"
                        ? "Continue"
                        : choice === "vacation"
                          ? vacationMode
                            ? "Go live"
                            : "Turn on vacation"
                          : "Continue"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
