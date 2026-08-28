"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { sellerRespondBoardBuyAction, withdrawBoardBuyAction } from "@/lib/actions/boardBuyActions"
import { isQuotedBoardBuyStatus } from "@/lib/board-buy/constants"
import { sellerVisibleQuoteMessage } from "@/lib/board-buy/quote-message"
import { formatBoardBuyUsd } from "@/lib/board-buy/quote-href"
import { Button } from "@/components/ui/button"
import { LocalDateTime } from "@/components/ui/local-datetime"
import type { BoardBuySubmission } from "@/lib/types/board-buy"

export function BoardBuyQuoteResponseCard({ submission }: { submission: BoardBuySubmission }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const quoted = isQuotedBoardBuyStatus(submission.status)
  const waiting = submission.status === "submitted"

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

  return (
    <section className="rounded-2xl border border-[#001A4A]/15 bg-[#F4F7FB] p-5 sm:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
        Response from Reswell
      </h2>
      {submission.offeredPrice != null ? (
        <p className="mt-3 font-headline text-3xl font-bold tabular-nums text-[#001A4A]">
          {formatBoardBuyUsd(submission.offeredPrice)}
        </p>
      ) : (
        <p className="mt-3 font-headline text-xl font-bold text-[#001A4A]">In review</p>
      )}
      {submission.quotedAt ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Quoted <LocalDateTime iso={submission.quotedAt} />
        </p>
      ) : null}
      <p className="mt-4 text-sm leading-relaxed text-[#001A4A]/80">
        {sellerVisibleQuoteMessage(submission)}
      </p>
      {quoted ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            disabled={pending}
            className="rounded-full bg-[#001A4A] px-6 hover:bg-[#001A4A]/90"
            onClick={() => void respond("accept")}
          >
            Accept {formatBoardBuyUsd(submission.offeredPrice ?? 0)}
          </Button>
          <Button disabled={pending} variant="outline" className="rounded-full" onClick={() => void respond("decline")}>
            Decline offer
          </Button>
        </div>
      ) : null}
      {waiting ? (
        <Button disabled={pending} variant="ghost" className="mt-4 px-0" onClick={() => void withdraw()}>
          Withdraw this quote
        </Button>
      ) : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
