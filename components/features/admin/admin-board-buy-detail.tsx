"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  opsMarkReceivedAndPayAction,
  opsPurchaseBoardBuyLabelAction,
  opsQuoteBoardBuyAction,
} from "@/lib/actions/boardBuyActions"
import { computeAutoOfferUsd } from "@/lib/board-buy/constants"
import { boardBuyStatusLabel } from "@/components/features/board-buy/board-buy-status-label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { BoardBuyAdminListItem } from "@/lib/types/board-buy"

export function AdminBoardBuyDetail({ submission }: { submission: BoardBuyAdminListItem }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const autoOffer = computeAutoOfferUsd(submission.askingPrice)

  async function quote(mode: "accept_asking" | "counter" | "decline") {
    const form = document.getElementById("ops-quote-form") as HTMLFormElement | null
    const data = form ? new FormData(form) : new FormData()
    const offeredRaw = String(data.get("offeredPrice") ?? "")
    setPending(true)
    setError(null)
    const result = await opsQuoteBoardBuyAction({
      submissionId: submission.id,
      mode,
      offeredPrice: mode === "counter" ? Number(offeredRaw) : undefined,
      opsNotes: String(data.get("opsNotes") ?? "") || null,
    })
    setPending(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  async function buyLabel() {
    setPending(true)
    setError(null)
    const result = await opsPurchaseBoardBuyLabelAction({ submissionId: submission.id })
    setPending(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  async function pay() {
    setPending(true)
    setError(null)
    const result = await opsMarkReceivedAndPayAction({ submissionId: submission.id })
    setPending(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{boardBuyStatusLabel(submission.status)}</p>
        <h1 className="text-2xl font-semibold">{submission.title}</h1>
        <p className="mt-1 text-sm">
          {submission.sellerDisplayName ?? "Seller"} {submission.sellerEmail ? `· ${submission.sellerEmail}` : ""}
        </p>
        <p className="text-sm">
          Asking ${submission.askingPrice.toFixed(2)}
          {submission.offeredPrice != null ? ` · Offer $${submission.offeredPrice.toFixed(2)}` : ""}
          {" · "}
          SLA {new Date(submission.slaDeadlineAt).toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          Auto fallback if you miss SLA: ${autoOffer.toFixed(2)} (20% off)
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

      {submission.sellerNote ? (
        <p className="text-sm">
          <span className="font-medium">Seller note: </span>
          {submission.sellerNote}
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Ship from {submission.shipFromName}, {submission.shipFromLine1}, {submission.shipFromCity},{" "}
        {submission.shipFromState} {submission.shipFromPostal}
      </p>

      {submission.status === "submitted" ? (
        <form id="ops-quote-form" className="space-y-3 rounded-lg border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="offeredPrice">Counter price</Label>
            <Input id="offeredPrice" name="offeredPrice" inputMode="decimal" placeholder={String(autoOffer)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opsNotes">Internal notes</Label>
            <Textarea id="opsNotes" name="opsNotes" rows={2} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={() => void quote("accept_asking")}>
              Accept asking
            </Button>
            <Button type="button" disabled={pending} variant="outline" onClick={() => void quote("counter")}>
              Send counter
            </Button>
            <Button type="button" disabled={pending} variant="ghost" onClick={() => void quote("decline")}>
              Decline
            </Button>
          </div>
        </form>
      ) : null}

      {submission.status === "accepted" || submission.status === "label_ready" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} variant="outline" onClick={() => void buyLabel()}>
            {submission.labelPdfUrl ? "Label purchased" : "Purchase inbound label"}
          </Button>
          <Button type="button" disabled={pending} onClick={() => void pay()}>
            Mark received and pay wallet
          </Button>
        </div>
      ) : null}

      {submission.labelPdfUrl ? (
        <a className="text-sm underline" href={submission.labelPdfUrl} target="_blank" rel="noreferrer">
          Open label PDF
        </a>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
