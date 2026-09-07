import type { SupportCaseKind } from "@/lib/types/supportCase"

export type CaseSlaState = "resolved" | "overdue" | "due_soon" | "on_track"

export function slaHoursForCaseKind(kind: SupportCaseKind): number {
  if (kind === "safety") return 4
  if (kind === "protection_claim" || kind === "cancel_request") return 24
  return 48
}

export function caseSlaDueAt(createdAtIso: string, kind: SupportCaseKind): Date {
  return new Date(new Date(createdAtIso).getTime() + slaHoursForCaseKind(kind) * 60 * 60 * 1000)
}

export function caseSlaState(args: {
  createdAtIso: string
  kind: SupportCaseKind
  isOpen: boolean
  now?: Date
}): { dueAt: Date; state: CaseSlaState; hoursLeft: number } {
  const dueAt = caseSlaDueAt(args.createdAtIso, args.kind)
  if (!args.isOpen) {
    return { dueAt, state: "resolved", hoursLeft: 0 }
  }
  const now = args.now ?? new Date()
  const hoursLeft = (dueAt.getTime() - now.getTime()) / (60 * 60 * 1000)
  const windowHours = slaHoursForCaseKind(args.kind)
  if (hoursLeft <= 0) return { dueAt, state: "overdue", hoursLeft }
  if (hoursLeft <= windowHours * 0.25) return { dueAt, state: "due_soon", hoursLeft }
  return { dueAt, state: "on_track", hoursLeft }
}

export function formatSlaHoursLeft(hoursLeft: number): string {
  const abs = Math.abs(hoursLeft)
  if (abs < 1) {
    const mins = Math.max(1, Math.round(abs * 60))
    return `${mins}m`
  }
  if (abs < 24) return `${Math.round(abs)}h`
  const days = Math.round(abs / 24)
  return `${days}d`
}
