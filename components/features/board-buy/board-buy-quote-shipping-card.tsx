import { Download, Truck } from "lucide-react"
import { WeBuyPackedBoxForm } from "@/components/features/board-buy/we-buy-packed-box-form"
import { Button } from "@/components/ui/button"
import {
  BOARD_BUY_MAX_BOX_HEIGHT_IN,
  BOARD_BUY_MAX_BOX_WIDTH_IN,
} from "@/lib/board-buy/constants"
import type { BoardBuySubmission } from "@/lib/types/board-buy"

const STEPS = [
  `Box the board so the carton is no more than ${BOARD_BUY_MAX_BOX_WIDTH_IN}\" wide and ${BOARD_BUY_MAX_BOX_HEIGHT_IN}\" high.`,
  "Measure the outer packed box and submit length, width, height, and weight on this quote.",
  "Print the prepaid label Reswell buys for you and tape it on the box.",
  "Drop the package with the carrier. We pay your wallet after the board arrives.",
] as const

export function BoardBuyQuoteShippingCard({ submission }: { submission: BoardBuySubmission }) {
  const showPackForm = submission.status === "accepted" && !submission.labelPdfUrl
  const showLabel = Boolean(submission.labelPdfUrl)
  const showPrep =
    submission.status === "quoted" ||
    submission.status === "auto_quoted" ||
    submission.status === "accepted" ||
    submission.status === "label_ready" ||
    submission.status === "received" ||
    submission.status === "paid"

  if (!showPrep) return null

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-[#5574AD]" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
          Shipping to Reswell
        </h2>
      </div>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {submission.parcelLengthIn != null ? (
        <p className="mt-4 text-sm">
          Packed box on file: {submission.parcelLengthIn} × {submission.parcelWidthIn} ×{" "}
          {submission.parcelHeightIn} in, {submission.parcelWeightLb} lb
        </p>
      ) : null}
      {showPackForm ? <div className="mt-5"><WeBuyPackedBoxForm submissionId={submission.id} /></div> : null}
      {showLabel ? (
        <div className="mt-5 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
          <p className="font-medium text-foreground">Prepaid label ready</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Print this label, attach it to the carton, and hand it to the carrier.
            {submission.trackingNumber
              ? ` Tracking: ${submission.trackingCarrier ?? ""} ${submission.trackingNumber}.`
              : " Tracking appears after the first scan."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild className="rounded-full">
              <a href={submission.labelPdfUrl ?? "#"} target="_blank" rel="noreferrer">
                <Download className="mr-1.5 h-4 w-4" />
                Print shipping label
              </a>
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
