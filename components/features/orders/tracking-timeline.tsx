"use client"

import { useState } from "react"
import { MapPin } from "lucide-react"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import {
  TRACKING_ACTIVITY_PREVIEW_COUNT,
  formatTrackingEventLocation,
} from "@/lib/shipping/tracking-map-points"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LocalDateTime } from "@/components/ui/local-datetime"

export function TrackingTimeline({
  events,
}: {
  events: NonNullable<OrderTrackingDetail["events"]>
}) {
  const [expanded, setExpanded] = useState(false)
  const hiddenCount = Math.max(0, events.length - TRACKING_ACTIVITY_PREVIEW_COUNT)
  const visible = expanded ? events : events.slice(0, TRACKING_ACTIVITY_PREVIEW_COUNT)

  return (
    <div>
      <ol className="relative space-y-0">
        {visible.map((event, index) => {
          const isFirst = index === 0
          const isLast = index === visible.length - 1
          const location = formatTrackingEventLocation(event)
          return (
            <li key={`${event.occurred_at ?? "event"}-${index}`} className="relative flex gap-3 pb-3 last:pb-0">
              {!isLast ? (
                <span className="absolute left-[6px] top-3 h-[calc(100%-4px)] w-px bg-border" aria-hidden />
              ) : null}
              <span
                className={cn(
                  "relative z-[1] mt-1 h-3 w-3 shrink-0 rounded-full border-2 bg-background",
                  isFirst ? "border-primary bg-primary/15" : "border-muted-foreground/35",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                {event.description?.trim() ? (
                  <p className={cn("text-sm leading-snug", isFirst ? "font-medium text-foreground" : "text-foreground/90")}>
                    {event.description.trim()}
                  </p>
                ) : null}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-4 text-muted-foreground">
                  {location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      {location}
                    </span>
                  ) : null}
                  {event.occurred_at ? (
                    <>
                      {location ? <span aria-hidden>·</span> : null}
                      <LocalDateTime iso={event.occurred_at} dateStyle="medium" timeStyle="short" />
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      {hiddenCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-8 px-0 text-xs text-muted-foreground"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : `Show ${hiddenCount} earlier ${hiddenCount === 1 ? "scan" : "scans"}`}
        </Button>
      ) : null}
    </div>
  )
}
