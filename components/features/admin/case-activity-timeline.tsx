"use client"

import { format } from "date-fns"
import { Activity, CircleDot } from "lucide-react"
import type { SupportCaseEventRow } from "@/lib/db/supportCases"

interface CaseActivityTimelineProps {
  events: SupportCaseEventRow[]
  staffNames: Record<string, string>
}

function payloadText(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  return typeof value === "string" && value.trim() ? value.replaceAll("_", " ") : null
}

function eventDescription(event: SupportCaseEventRow): string {
  const to = payloadText(event.payload, "to")
  const status = payloadText(event.payload, "status")
  const carrierStatus = payloadText(event.payload, "carrier_claim_status")
  const amount = event.payload.amount_usd

  switch (event.event_type) {
    case "assigned":
      return event.payload.assignee_admin_id
        ? "Assigned the conversation"
        : "Removed the assignee"
    case "unassigned":
      return "Removed the assignee"
    case "status_changed":
      return `Changed status${status ? ` to ${status}` : ""}`
    case "priority_changed":
      return `Changed priority${to ? ` to ${to}` : ""}`
    case "outcome_changed":
      return `Set outcome${to ? ` to ${to}` : ""}`
    case "resolved":
      return "Resolved the conversation"
    case "order_refunded":
      return "Issued a refund"
    case "protection_repair_credit":
      return typeof amount === "number"
        ? `Granted a $${amount.toFixed(2)} repair credit`
        : "Granted a repair credit"
    case "carrier_claim_updated":
      return `Updated the carrier claim${carrierStatus ? ` to ${carrierStatus}` : ""}`
    case "evidence_attached":
      return "Attached claim evidence"
    default:
      return event.event_type.replaceAll("_", " ")
  }
}

export function CaseActivityTimeline({
  events,
  staffNames,
}: CaseActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center">
        <Activity className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden />
        <p className="mt-2 text-sm font-medium">No recorded activity yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Assignment, status, claim, and financial events will appear here.
        </p>
      </div>
    )
  }

  return (
    <ol className="space-y-0">
      {events.map((event, index) => (
        <li key={event.id} className="relative flex gap-3 pb-4">
          {index < events.length - 1 ? (
            <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden />
          ) : null}
          <CircleDot className="relative mt-0.5 h-4 w-4 shrink-0 bg-background text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs leading-5 text-foreground">
              {eventDescription(event)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {event.actor_admin_id
                ? staffNames[event.actor_admin_id] ?? "Staff"
                : "System"}
              {" · "}
              {format(new Date(event.created_at), "MMM d, h:mm a")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
