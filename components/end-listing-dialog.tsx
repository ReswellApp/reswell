"use client"

import { useRef, useState } from "react"
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
import { postMarkListingSold } from "@/lib/listing-mark-sold-request"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"

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

  function handleRelisted() {
    markedSoldRef.current = false
    resetState()
    onOpenChange(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (tipCheckoutActiveRef.current) return
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
      setLoading(true)
      try {
        const result = await postMarkListingSold(listingId)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        markedSoldRef.current = true
        setSoldPriceUsd(
          result.priceUsd > 0
            ? result.priceUsd
            : typeof listingPriceUsd === "number" && listingPriceUsd > 0
              ? listingPriceUsd
              : null,
        )
        setStep("sold_survey")
      } finally {
        setLoading(false)
      }
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
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        showCloseButton={!tipCheckoutActive}
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
      >
        {followUpOpen ? (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle>Congrats on the sale</DialogTitle>
              <DialogDescription>
                Where it sold, plus an optional tip to Reswell and a rating.
              </DialogDescription>
            </DialogHeader>
            {listingId ? (
              <MarkSoldFollowUp
                listingId={listingId}
                listingPriceUsd={followUpPriceUsd}
                onCheckoutActiveChange={handleCheckoutActiveChange}
                onClose={closeAndRefreshIfSold}
                onRelisted={handleRelisted}
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
                      ? "Saving…"
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
                        ? "Mark as sold"
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
