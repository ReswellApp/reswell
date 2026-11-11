import { purchaseAccentTextClassName } from "@/components/features/purchases/purchase-brand-styles"
import { LocalDateTime } from "@/components/ui/local-datetime"
import type { PurchaseTimelineEvent } from "@/lib/purchase-detail-timeline"
import { cn } from "@/lib/utils"

interface FulfillmentTimelineProps {
  heading: string
  timeline: PurchaseTimelineEvent[]
}

export function FulfillmentTimeline({ heading, timeline }: FulfillmentTimelineProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-foreground">{heading}</h2>
      <ol>
        {timeline.map((step, index) => {
          const last = index === timeline.length - 1
          return (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!last ? (
                <span
                  className={cn(
                    "absolute left-[5px] top-3 h-[calc(100%-4px)] w-px",
                    step.state === "upcoming" ? "bg-border" : "bg-green-600/50",
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "relative z-[1] mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                  step.state === "upcoming" ? "border border-muted-foreground/40 bg-background" : "bg-green-600",
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    step.state === "upcoming" ? "text-muted-foreground" : purchaseAccentTextClassName,
                  )}
                >
                  {step.title}
                </p>
                {step.occurredAt ? (
                  <p className="text-xs text-muted-foreground">
                    <LocalDateTime iso={step.occurredAt} dateStyle="medium" timeStyle="short" />
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
