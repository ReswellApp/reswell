"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, BookOpen, Package, Truck } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getReswellShippingGuideTopic,
  RESWELL_SHIPPING_GUIDE_NAV,
  type ReswellShippingGuideTopicId,
} from "@/lib/reswell-shipping-guide"
import { cn } from "@/lib/utils"

export type ReswellShippingGuideDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Topic shown when the dialog opens (or when this prop changes while open). */
  topicId?: ReswellShippingGuideTopicId
}

function topicIcon(topicId: ReswellShippingGuideTopicId) {
  if (topicId === "overview") return BookOpen
  if (
    topicId === "shortboard_compact" ||
    topicId === "shortboard_standard" ||
    topicId === "shortboard_max"
  ) {
    return Package
  }
  return Truck
}

export function ReswellShippingGuideDialog({
  open,
  onOpenChange,
  topicId = "overview",
}: ReswellShippingGuideDialogProps) {
  const [activeId, setActiveId] = useState<ReswellShippingGuideTopicId>(topicId)

  useEffect(() => {
    if (open) setActiveId(topicId)
  }, [open, topicId])

  const topic = getReswellShippingGuideTopic(activeId)
  const Icon = topicIcon(topic.id)
  const showBack = activeId !== "overview"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,720px)] w-full max-w-[min(100vw-1.5rem,40rem)] flex-col gap-0 overflow-hidden rounded-xl border border-border bg-background p-0 shadow-lg sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 pb-4 pt-6 pr-12 text-left sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
            Reswell shipping
          </p>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Seller guide
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            How buyer-paid shipping works, and what each size means when you list.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav
            aria-label="Guide topics"
            className="shrink-0 border-b border-border bg-muted/20 px-3 py-3 sm:w-44 sm:border-b-0 sm:border-r sm:py-4"
          >
            <div className="flex gap-1 overflow-x-auto pb-0.5 sm:flex-col sm:gap-3 sm:overflow-visible sm:pb-0">
              {RESWELL_SHIPPING_GUIDE_NAV.map((group) => (
                <div key={group.heading} className="flex shrink-0 items-center gap-1 sm:block sm:space-y-1">
                  <p className="hidden px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/55 sm:block">
                    {group.heading}
                  </p>
                  {group.topicIds.map((id) => {
                    const navTopic = getReswellShippingGuideTopic(id)
                    const selected = activeId === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveId(id)}
                        className={cn(
                          "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors sm:w-full",
                          selected
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-foreground/80 hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {navTopic.navLabel}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            {showBack ? (
              <button
                type="button"
                onClick={() => setActiveId("overview")}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back to overview
              </button>
            ) : null}

            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                aria-hidden
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="text-base font-semibold text-foreground sm:text-lg">{topic.label}</h3>
                <p className="text-sm leading-relaxed text-foreground/85">{topic.headline}</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{topic.summary}</p>

            {topic.sizeLine ? (
              <div className="mt-4 rounded-xl border border-border bg-muted/25 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">
                  Quoted box size
                </p>
                <p className="mt-1 text-sm font-medium tabular-nums text-foreground">
                  {topic.sizeLine}
                </p>
              </div>
            ) : null}

            <ol className="mt-5 space-y-3">
              {topic.bullets.map((bullet) => (
                <li
                  key={bullet.title}
                  className="rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-sm"
                >
                  <p className="text-sm font-semibold text-foreground">{bullet.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{bullet.body}</p>
                </li>
              ))}
            </ol>

            {topic.relatedIds && topic.relatedIds.length > 0 ? (
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">
                  Learn more
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {topic.relatedIds.map((id) => {
                    const related = getReswellShippingGuideTopic(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveId(id)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        {related.navLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
