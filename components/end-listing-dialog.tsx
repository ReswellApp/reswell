"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { postEndListing } from "@/lib/listing-end-request"
import { postMarkListingSold } from "@/lib/listing-mark-sold-request"
import {
  SOLD_OFF_PLATFORM_CHANNEL_LABELS,
  type SoldOffPlatformChannel,
} from "@/lib/validations/mark-listing-sold"

type EndChoice = "delete" | "archive" | "mark_sold" | null
type DialogStep = "main" | "sold_channel"

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
  const [soldChannel, setSoldChannel] = useState<SoldOffPlatformChannel | null>(null)
  const [elsewhereDetail, setElsewhereDetail] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function resetState() {
    setStep("main")
    setChoice(null)
    setSoldChannel(null)
    setElsewhereDetail("")
    setLoading(false)
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  function selectMainChoice(nextChoice: Exclude<EndChoice, null>) {
    setChoice(nextChoice)
    if (nextChoice === "mark_sold") {
      setSoldChannel(null)
      setElsewhereDetail("")
      setStep("sold_channel")
    }
  }

  function handleBack() {
    setStep("main")
    setSoldChannel(null)
    setElsewhereDetail("")
    setChoice(null)
  }

  const elsewhereDetailValid =
    soldChannel !== "elsewhere" || elsewhereDetail.trim().length >= 2

  const canConfirmSoldChannel =
    !!soldChannel && elsewhereDetailValid && !loading

  async function handleConfirm() {
    if (!listingId || !choice) return

    if (choice === "mark_sold") {
      if (!soldChannel || !elsewhereDetailValid) return
      setLoading(true)
      try {
        const result = await postMarkListingSold(listingId, {
          channel: soldChannel,
          detail: soldChannel === "elsewhere" ? elsewhereDetail.trim() : undefined,
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success("Listing marked as sold")
        onComplete?.({ mode: "mark_sold" })
        handleDialogOpenChange(false)
        router.refresh()
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
      <AlertDialogContent>
        {step === "main" ? (
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
                onClick={() => selectMainChoice("archive")}
              >
                Archive listing
              </Button>
              <Button
                variant={choice === "mark_sold" ? "default" : "outline"}
                className="justify-start"
                type="button"
                onClick={() => selectMainChoice("mark_sold")}
              >
                Mark as sold
              </Button>
              <Button
                variant={choice === "delete" ? "destructive" : "outline"}
                className="justify-start"
                type="button"
                onClick={() => selectMainChoice("delete")}
              >
                Delete listing
              </Button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant={choice === "delete" ? "destructive" : "default"}
                disabled={!choice || choice === "mark_sold" || loading}
                onClick={() => void handleConfirm()}
              >
                {loading
                  ? choice === "delete"
                    ? "Deleting…"
                    : "Archiving…"
                  : choice === "delete"
                    ? "Delete listing"
                    : choice === "archive"
                      ? "Archive listing"
                      : "Continue"}
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Where did you sell it?</AlertDialogTitle>
              <AlertDialogDescription>
                This helps us understand how sellers close deals. Your listing stays on Reswell as sold
                for your records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2 py-2">
              {(Object.keys(SOLD_OFF_PLATFORM_CHANNEL_LABELS) as SoldOffPlatformChannel[]).map(
                (channel) => (
                  <Button
                    key={channel}
                    variant={soldChannel === channel ? "default" : "outline"}
                    className="justify-start"
                    type="button"
                    onClick={() => setSoldChannel(channel)}
                  >
                    {SOLD_OFF_PLATFORM_CHANNEL_LABELS[channel]}
                  </Button>
                ),
              )}
              {soldChannel === "elsewhere" ? (
                <div className="space-y-2 pt-1">
                  <Input
                    value={elsewhereDetail}
                    onChange={(e) => setElsewhereDetail(e.target.value)}
                    placeholder="Where did you sell it?"
                    maxLength={200}
                    disabled={loading}
                    aria-invalid={!elsewhereDetailValid}
                  />
                  {!elsewhereDetailValid ? (
                    <p className="text-sm text-destructive">
                      Please tell us where you sold this item.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <AlertDialogFooter>
              <Button type="button" variant="outline" disabled={loading} onClick={handleBack}>
                Back
              </Button>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                disabled={!canConfirmSoldChannel}
                onClick={() => void handleConfirm()}
              >
                {loading ? "Saving…" : "Mark as sold"}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
