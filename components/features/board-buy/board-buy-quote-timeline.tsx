import { LocalDateTime } from "@/components/ui/local-datetime"
import type { BoardBuySubmission } from "@/lib/types/board-buy"

type Step = { label: string; at: string | null }

export function BoardBuyQuoteTimeline({ submission }: { submission: BoardBuySubmission }) {
  const steps: Step[] = [
    { label: "Submitted", at: submission.createdAt },
    { label: "Reswell responded", at: submission.quotedAt },
    { label: "You accepted", at: submission.acceptedAt },
    { label: "Label issued", at: submission.labelPdfUrl ? submission.updatedAt : null },
    { label: "Received at Reswell", at: submission.receivedAt },
    { label: "Paid to wallet", at: submission.paidAt },
  ]
  if (submission.status === "declined") {
    steps.splice(2, 0, { label: "Declined", at: submission.declinedAt })
  }
  if (submission.status === "withdrawn") {
    steps.push({ label: "Withdrawn", at: submission.updatedAt })
  }

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5574AD]">Quote timeline</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.label} className="flex items-baseline justify-between gap-4 text-sm">
            <span className={step.at ? "font-medium text-foreground" : "text-muted-foreground"}>
              {step.label}
            </span>
            {step.at ? (
              <LocalDateTime iso={step.at} className="text-muted-foreground" />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
