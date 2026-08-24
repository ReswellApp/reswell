"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  const markedSoldRef = useRef(false)
  const router = useRouter()

  function resetState() {
    setStep("main")
    setChoice(null)
    setLoading(false)
    setSoldPriceUsd(null)
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

  function handleAlertOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (markedSoldRef.current) return
      closeAndRefreshIfSold()
      return
    }
    onOpenChange(true)
  }

  function handleSurveyOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      closeAndRefreshIfSold()
    }
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

  return (
    <>
      <AlertDialog open={open && step === "main"} onOpenChange={handleAlertOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End listing</AlertDialogTitle>
            <AlertDialogDescription>
              {canUseListingVacationMode(listingStatus)
                ? "Vacation hides a live listing until you go live again. "
                : null}
              Archive removes it from the public site and keeps it under Archived listings for 30
              days.
              {canDelete
                ? " Delete removes the listing immediately."
                : " This listing is tied to an order or payment, so it can be archived instead of deleted."}{" "}
              Mark as sold keeps it on file when you closed the sale elsewhere.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open && step === "sold_survey"} onOpenChange={handleSurveyOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="pr-8">
            <DialogTitle>Congrats on the sale</DialogTitle>
            <DialogDescription>
              Where it sold, plus an optional tip and rating.
            </DialogDescription>
          </DialogHeader>
          {listingId ? (
            <MarkSoldFollowUp
              listingId={listingId}
              listingPriceUsd={followUpPriceUsd}
              onClose={closeAndRefreshIfSold}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
