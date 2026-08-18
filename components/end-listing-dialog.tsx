"use client"

import { useState } from "react"
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
import { MarkSoldFollowUp } from "@/components/features/listings/mark-sold-follow-up"
import { toast } from "sonner"
import { postEndListing } from "@/lib/listing-end-request"
import { postMarkListingSold } from "@/lib/listing-mark-sold-request"
import { cn } from "@/lib/utils"

type EndChoice = "delete" | "archive" | "mark_sold" | null
type DialogStep = "main" | "sold_survey"

export type EndListingDialogResult =
  | { mode: "archive"; message?: string }
  | { mode: "delete" }
  | { mode: "mark_sold" }

interface EndListingDialogProps {
  listingId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (result: EndListingDialogResult) => void
}

export function EndListingDialog({
  listingId,
  open,
  onOpenChange,
  onComplete,
}: EndListingDialogProps) {
  const [step, setStep] = useState<DialogStep>("main")
  const [choice, setChoice] = useState<EndChoice>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function resetState() {
    setStep("main")
    setChoice(null)
    setLoading(false)
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    if (!listingId || !choice) return

    if (choice === "mark_sold") {
      setLoading(true)
      try {
        const result = await postMarkListingSold(listingId)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success("Listing marked as sold")
        onComplete?.({ mode: "mark_sold" })
        router.refresh()
        setStep("sold_survey")
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      const result = await postEndListing(listingId, choice)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      if (result.mode === "delete") {
        onComplete?.({ mode: "delete" })
        handleDialogOpenChange(false)
        router.push("/dashboard/listings")
        return
      }

      onComplete?.({ mode: "archive", message: result.message })
      handleDialogOpenChange(false)
      router.push("/dashboard/listings/archived")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleDialogOpenChange}>
      <AlertDialogContent
        className={cn(step === "sold_survey" && "max-h-[90vh] overflow-y-auto")}
      >
        {step === "sold_survey" && listingId ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Congrats on the sale</AlertDialogTitle>
              <AlertDialogDescription className="sr-only">
                Optional follow-up about where you sold, whether Reswell helped find a buyer,
                and an optional tip.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <MarkSoldFollowUp
              listingId={listingId}
              onClose={() => handleDialogOpenChange(false)}
            />
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>End listing</AlertDialogTitle>
              <AlertDialogDescription>
                Archive removes your listing from the public site and keeps it under Archived listings
                for 30 days. Delete removes the database record immediately when allowed; if the
                listing is linked to an order or payment, we will archive it instead so it stays off
                the live site. Mark as sold keeps your listing on file and shows it as sold when you
                closed the sale elsewhere. Choose an option:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2 py-2">
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
              <Button
                variant={choice === "delete" ? "destructive" : "outline"}
                className="justify-start"
                type="button"
                onClick={() => setChoice("delete")}
              >
                Delete listing
              </Button>
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
                      : "Archiving…"
                  : choice === "delete"
                    ? "Delete listing"
                    : choice === "archive"
                      ? "Archive listing"
                      : choice === "mark_sold"
                        ? "Mark as sold"
                        : "Continue"}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
