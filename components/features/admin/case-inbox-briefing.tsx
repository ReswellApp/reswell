"use client"

import { useMemo } from "react"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import type { CaseInboxItem } from "@/lib/admin/case-inbox"
import type { CaseOrderLabelContext } from "@/lib/admin/admin-order-capabilities"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import { buildCaseBriefing } from "@/lib/admin/case-briefing"
import { AdminShippingLabelPreviewButton } from "@/components/features/admin/admin-shipping-label-preview-button"

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
  const briefing = useMemo(
    () => buildCaseBriefing({ item, messages, order, extras }),
    [item, messages, order, extras],
  )

  const showLabel = extras?.hasShippingLabel === true && Boolean(item.orderId)

  return (
    <div className="max-h-[36%] shrink-0 overflow-y-auto border-b border-border/60 bg-muted/25 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        What’s going on
      </p>
      <p className="mt-1 text-sm text-foreground">{briefing.summary}</p>
      {briefing.ask ? (
        <p className="mt-1.5 text-sm text-foreground">
          They said: “{briefing.ask}”
        </p>
      ) : null}
      {briefing.latestUpdate ? (
        <p className="mt-0.5 text-sm text-foreground">
          Latest: “{briefing.latestUpdate}”
        </p>
      ) : null}
      {briefing.facts.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {briefing.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      ) : null}
      {briefing.hints.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {briefing.hints.map((hint) => (
            <p key={hint} className="text-xs leading-relaxed text-foreground">
              {hint}
            </p>
          ))}
        </div>
      ) : null}
      {showLabel && item.orderId ? (
        <AdminShippingLabelPreviewButton orderId={item.orderId} className="mt-2.5" />
      ) : null}
    </div>
  )
}
