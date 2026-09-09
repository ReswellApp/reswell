"use client"

import { useMemo, useState } from "react"
import { ChevronDown, FileText } from "lucide-react"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import type { CaseInboxItem } from "@/lib/admin/case-inbox"
import type { CaseOrderLabelContext } from "@/lib/admin/admin-order-capabilities"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import { buildCaseBriefing } from "@/lib/admin/case-briefing"
import { AdminShippingLabelPreviewButton } from "@/components/features/admin/admin-shipping-label-preview-button"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CaseInboxBriefingProps {
  item: CaseInboxItem
  messages: SupportCaseThreadMessage[]
  order: AdminOrderDetail | null
  extras: CaseOrderLabelContext | null
}

export function CaseInboxBriefing({
  item,
  messages,
  order,
  extras,
}: CaseInboxBriefingProps) {
  const [expanded, setExpanded] = useState(false)
  const briefing = useMemo(
    () => buildCaseBriefing({ item, messages, order, extras }),
    [item, messages, order, extras],
  )

  const showLabel = extras?.hasShippingLabel === true && Boolean(item.orderId)
  const hasDetails =
    Boolean(briefing.latestUpdate) ||
    briefing.facts.length > 0 ||
    briefing.hints.length > 0

  return (
    <div
      className={cn(
        "mx-3 mt-3 shrink-0 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5",
        expanded && "max-h-[40%] overflow-y-auto",
      )}
    >
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        {hasDetails ? (
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-6 px-2 text-[11px]" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Less" : "Details"}
            <ChevronDown className={cn("ml-1 h-3 w-3 transition-transform", expanded && "rotate-180")} aria-hidden />
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{briefing.summary}</p>
      {expanded ? (
        <>
          {briefing.latestUpdate ? <p className="mt-0.5 text-sm text-foreground">Latest: “{briefing.latestUpdate}”</p> : null}
          {briefing.facts.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {briefing.facts.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>
          ) : null}
          {briefing.hints.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {briefing.hints.map((hint) => <p key={hint} className="text-xs leading-relaxed text-foreground">{hint}</p>)}
            </div>
          ) : null}
        </>
      ) : null}
      {showLabel && item.orderId ? (
        <AdminShippingLabelPreviewButton orderId={item.orderId} className="mt-2.5" />
      ) : null}
    </div>
  )
}
