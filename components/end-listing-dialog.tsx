"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
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
import { canUseListingVacationMode } from "@/lib/listing-vacation-mode"
import { toast } from "sonner"
import { setListingVacationModeAction } from "@/lib/actions/listingVacationMode"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"
import { prefetchSaleTipCheckout } from "@/lib/stripe/prefetch-sale-tip-checkout"
import { cn } from "@/lib/utils"

type EndChoice = "delete" | "mark_sold" | "vacation" | null
type DialogStep = "main" | "sold_survey" | "delete_survey"

export type EndListingDialogResult =
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
  const [soldThanks, setSoldThanks] = useState(false)
  const markedSoldRef = useRef(false)
  const deletedRef = useRef(false)
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
    setSoldThanks(false)
    tipCheckoutActiveRef.current = false
  }

  function closeAndRefreshIfEnded() {
    const sold = markedSoldRef.current
    const deleted = deletedRef.current
    resetState()
    markedSoldRef.current = false
    deletedRef.current = false
    onOpenChange(false)
    if (deleted) {
      toast.success("Listing deleted")
      onComplete?.({ mode: "delete" })
      router.push("/dashboard/listings")
      router.refresh()
      return
    }
    if (sold) {
      toast.success("Listing marked as sold")
      onComplete?.({ mode: "mark_sold" })
      router.refresh()
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // Stripe's iframe teardown looks like an outside dismiss. Keep the
      // follow-up (including "Tip sent") open until the user hits close.
      if (step === "sold_survey" || step === "delete_survey") return
      closeAndRefreshIfEnded()
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

    if (choice === "delete") {
      if (!canDelete) return
      setSoldPriceUsd(
        typeof listingPriceUsd === "number" && listingPriceUsd > 0 ? listingPriceUsd : null,
      )
      setStep("delete_survey")
    }
  }

  const followUpPriceUsd =
    soldPriceUsd ??
    (typeof listingPriceUsd === "number" && listingPriceUsd > 0 ? listingPriceUsd : null)
  const followUpOpen = step === "sold_survey" || step === "delete_survey"
  const followUpIntent = step === "delete_survey" ? "delete" : "mark_sold"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          followUpOpen
            ? [
                "left-0 top-0 flex max-h-[100dvh] min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-3 overflow-hidden overscroll-none rounded-none",
                "p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
                "sm:left-[50%] sm:top-[50%] sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:p-5",
                soldThanks
                  ? "h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-2rem)]"
                  : tipCheckoutActive
                    ? "h-[100dvh] sm:h-[min(48rem,calc(100dvh-2rem))] sm:max-h-[calc(100dvh-2rem)]"
                    : "h-[100dvh] sm:h-[min(40rem,calc(100dvh-2rem))] sm:max-h-[calc(100dvh-2rem)]",
              ]
            : "max-h-[90vh] overflow-y-auto sm:max-w-lg",
        )}
        showCloseButton={!followUpOpen}
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
        onEscapeKeyDown={(event) => {
          if (followUpOpen) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          if (followUpOpen) event.preventDefault()
        }}
      >
        {followUpOpen ? (
          <>
            <button
              type="button"
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={closeAndRefreshIfEnded}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            {soldThanks ? null : (
              <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
                <DialogTitle className="text-base">
                  {followUpIntent === "delete" ? "Before you delete" : "Congrats on the sale"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {followUpIntent === "delete"
                    ? "Optional tip and a rating — same as marking a listing sold."
                    : "Where it sold, optional tip, and a rating."}
                </DialogDescription>
              </DialogHeader>
            )}
            {listingId ? (
              <MarkSoldFollowUp
                listingId={listingId}
                listingPriceUsd={followUpPriceUsd}
                intent={followUpIntent}
                onCheckoutActiveChange={handleCheckoutActiveChange}
                onClose={closeAndRefreshIfEnded}
                onFinished={() => setSoldThanks(true)}
                onMarkedSold={() => {
                  markedSoldRef.current = true
                }}
                onDeleted={() => {
                  deletedRef.current = true
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
                  ? "Vacation mode temporarily hides a live listing until you go live again. "
                  : null}
                {canDelete
                  ? "Delete removes the listing immediately."
                  : "This listing is tied to an order or payment, so it cannot be permanently deleted."}{" "}
                Mark as sold keeps it on file when you closed the sale elsewhere.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              {canUseListingVacationMode(listingStatus) ? (
                <Button
                  variant={choice === "vacation" ? "default" : "outline"}
                  className="h-auto justify-start py-2"
                  type="button"
                  onClick={() => setChoice("vacation")}
                >
                  <span className="flex flex-col items-start text-left">
                    <span>{vacationMode ? "Go live" : "Vacation mode"}</span>
                    <span
                      className={cn(
                        "text-xs font-normal",
                        choice === "vacation" ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {vacationMode ? "Show on the site again" : "(temporarily hide)"}
                    </span>
                  </span>
                </Button>
              ) : null}
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
                onClick={closeAndRefreshIfEnded}
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
                  ? choice === "vacation"
                    ? vacationMode
                      ? "Going live…"
                      : "Updating…"
                    : "Continue"
                  : choice === "delete"
                    ? "Continue"
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
