import Link from "next/link"
import { BoardBuyQuoteCopyLink } from "@/components/features/board-buy/board-buy-quote-copy-link"
import { BoardBuyQuotePhotos } from "@/components/features/board-buy/board-buy-quote-photos"
import { BoardBuyQuoteResponseCard } from "@/components/features/board-buy/board-buy-quote-response-card"
import { BoardBuyQuoteShippingCard } from "@/components/features/board-buy/board-buy-quote-shipping-card"
import { BoardBuyQuoteSubmissionCard } from "@/components/features/board-buy/board-buy-quote-submission-card"
import { BoardBuyQuoteTimeline } from "@/components/features/board-buy/board-buy-quote-timeline"
import { boardBuyStatusLabel } from "@/components/features/board-buy/board-buy-status-label"
import { formatBoardBuyUsd, boardBuyQuotePath, boardBuyQuoteRef } from "@/lib/board-buy/quote-href"
import type { BoardBuySubmission } from "@/lib/types/board-buy"

export function BoardBuyQuoteDocument({ submission }: { submission: BoardBuySubmission }) {
  const path = boardBuyQuotePath(submission.id)

  return (
    <article className="mx-auto w-full max-w-5xl">
      <header className="border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/we-buy" className="text-sm text-muted-foreground hover:text-foreground">
            ← All quotes
          </Link>
          <BoardBuyQuoteCopyLink href={path} />
        </div>
        <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#5574AD]">
          Sell to Reswell · Quote {boardBuyQuoteRef(submission.id)}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl">
            {submission.title}
          </h1>
          <span className="rounded-full border border-[#001A4A]/15 bg-[#F4F7FB] px-3 py-1 text-xs font-medium text-[#001A4A]">
            {boardBuyStatusLabel(submission.status)}
          </span>
        </div>
        <p className="mt-2 text-sm text-[#5c6b89]">
          Asking {formatBoardBuyUsd(submission.askingPrice)}
          {submission.offeredPrice != null
            ? ` · Reswell offer ${formatBoardBuyUsd(submission.offeredPrice)}`
            : ""}
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <BoardBuyQuotePhotos photos={submission.photos} />
        <div className="space-y-5">
          <BoardBuyQuoteResponseCard submission={submission} />
          <BoardBuyQuoteSubmissionCard submission={submission} />
        </div>
      </div>

      <div className="mt-8 space-y-5">
        <BoardBuyQuoteShippingCard submission={submission} />
        <BoardBuyQuoteTimeline submission={submission} />
        {submission.status === "paid" ? (
          <p className="rounded-2xl border bg-card p-5 text-sm">
            Paid {formatBoardBuyUsd(submission.offeredPrice ?? 0)} to your{" "}
            <Link href="/dashboard/wallet" className="font-medium underline">
              Reswell wallet
            </Link>
            . Connect a bank to cash out.
          </p>
        ) : null}
      </div>
    </article>
  )
}
