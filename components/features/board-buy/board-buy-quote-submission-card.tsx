import { LocalDateTime } from "@/components/ui/local-datetime"
import { formatBoardBuyUsd } from "@/lib/board-buy/quote-href"
import type { BoardBuySubmission } from "@/lib/types/board-buy"

export function BoardBuyQuoteSubmissionCard({ submission }: { submission: BoardBuySubmission }) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5574AD]">Your board</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Asking price</dt>
          <dd className="font-semibold tabular-nums">{formatBoardBuyUsd(submission.askingPrice)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Submitted</dt>
          <dd>
            <LocalDateTime iso={submission.createdAt} />
          </dd>
        </div>
        {submission.sellerNote ? (
          <div>
            <dt className="text-muted-foreground">Your notes</dt>
            <dd className="mt-1 whitespace-pre-wrap text-foreground">{submission.sellerNote}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Ship from</dt>
          <dd className="mt-1 leading-relaxed">
            {submission.shipFromName}
            <br />
            {submission.shipFromLine1}
            {submission.shipFromLine2 ? (
              <>
                <br />
                {submission.shipFromLine2}
              </>
            ) : null}
            <br />
            {submission.shipFromCity}, {submission.shipFromState} {submission.shipFromPostal}
            <br />
            {submission.shipFromPhone}
          </dd>
        </div>
      </dl>
    </section>
  )
}
