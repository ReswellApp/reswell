"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { sellerRespondBoardBuyAction, withdrawBoardBuyAction } from "@/lib/actions/boardBuyActions"
import { isQuotedBoardBuyStatus } from "@/lib/board-buy/constants"
import { boardBuyStatusLabel } from "@/components/features/board-buy/board-buy-status-label"
import { Button } from "@/components/ui/button"
import type { BoardBuySubmission } from "@/lib/types/board-buy"

export function DashboardBoardBuyDetail({ submission }: { submission: BoardBuySubmission }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function respond(decision: "accept" | "decline") {
    setPending(true)
    setError(null)
    const result = await sellerRespondBoardBuyAction({ submissionId: submission.id, decision })
    setPending(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  async function withdraw() {
    setPending(true)
    setError(null)
    const result = await withdrawBoardBuyAction({ submissionId: submission.id })
    setPending(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  const quoted = isQuotedBoardBuyStatus(submission.status)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{boardBuyStatusLabel(submission.status)}</p>
        <h1 className="font-headline text-2xl font-bold text-[#001A4A]">{submission.title}</h1>
        <p className="mt-1 text-sm">
          Asking ${submission.askingPrice.toFixed(2)}
          {submission.offeredPrice != null
            ? ` · Our offer $${submission.offeredPrice.toFixed(2)}`
            : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {submission.photos.map((photo) => (
          <div key={photo.id} className="aspect-square overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>

      {quoted ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm">
            {submission.quoteSource === "auto_sla"
              ? "We missed the 30-minute window, so this is an automatic offer at 20% off your asking price."
              : "Reswell sent an offer. Accept to get a prepaid shipping label."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => void respond("accept")}>
              Accept ${submission.offeredPrice?.toFixed(2)}
            </Button>
            <Button disabled={pending} variant="outline" onClick={() => void respond("decline")}>
              Decline
            </Button>
          </div>
        </div>
      ) : null}

      {submission.status === "submitted" ? (
        <Button disabled={pending} variant="ghost" onClick={() => void withdraw()}>
          Withdraw
        </Button>
      ) : null}

      {submission.labelPdfUrl ? (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">Shipping label ready</p>
          <p className="mt-1 text-muted-foreground">
            Box the board, print the label, and drop it with the carrier. Tracking{" "}
            {submission.trackingNumber ?? "will appear after scan"}.
          </p>
          <Button asChild className="mt-3">
            <a href={submission.labelPdfUrl} target="_blank" rel="noreferrer">
              Print shipping label
            </a>
          </Button>
        </div>
      ) : null}

      {submission.status === "paid" ? (
        <p className="text-sm">
          Paid ${submission.offeredPrice?.toFixed(2)} to your{" "}
          <a className="underline" href="/dashboard/wallet">
            wallet
          </a>
          . Connect a bank to cash out.
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
