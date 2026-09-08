"use client"

import Link from "next/link"
import { format } from "date-fns"
import { CheckCircle2, RotateCcw } from "lucide-react"
import type { OrderSupportOutcome } from "@/lib/db/order-support"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import type { StaffAssigneeRow } from "@/lib/db/searchInsightActions"
import type { CaseInboxItem } from "@/lib/admin/case-inbox"
import type { SupportCaseStatus } from "@/lib/types/supportCase"
import { CaseAssigneeSelect } from "@/components/features/admin/case-assignee-select"
import { CaseIssueRefundPanel } from "@/components/features/admin/case-issue-refund-panel"
import { CaseOrderContextPanel } from "@/components/features/admin/case-order-context-panel"
import { ProtectionClaimDesk } from "@/components/features/admin/protection-claim-desk"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { inboxInitials } from "@/lib/admin/case-inbox"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"
import { cn } from "@/lib/utils"

const WORKFLOW_STATUSES: { value: SupportCaseStatus; label: string }[] = [
  { value: "submitted", label: "New" },
  { value: "in_review", label: "In review" },
  { value: "in_progress", label: "Open" },
  { value: "waiting_on_you", label: "Waiting on customer" },
  { value: "resolved", label: "Resolved" },
]

const OUTCOME_OPTIONS: { value: OrderSupportOutcome; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "partial", label: "Partial" },
  { value: "denied", label: "Denied" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "cancelled", label: "Cancelled" },
  { value: "informed", label: "Informed" },
]

interface CaseInboxDetailsProps {
  item: CaseInboxItem
  staff: StaffAssigneeRow[]
  currentStaffId: string | null
  isAdmin: boolean
  osOutcome: string
  pinnedNote: string
  savePending: boolean
  orderContext: AdminOrderDetail | null
  onAssigned: (id: string | null) => void
  onStatus: (status: SupportCaseStatus) => void
  onResolve: () => void
  onReopen: () => void
  onOrderOutcome: (outcome: string) => void
  onPinnedNote: (note: string) => void
  onPinnedNoteBlur: () => void
  onOrderContextLoaded: (detail: AdminOrderDetail) => void
  onRefundComplete: () => void
}

export function CaseInboxDetails({
  item,
  staff,
  currentStaffId,
  isAdmin,
  osOutcome,
  pinnedNote,
  savePending,
  orderContext,
  onAssigned,
  onStatus,
  onResolve,
  onReopen,
  onOrderOutcome,
  onPinnedNote,
  onPinnedNoteBlur,
  onOrderContextLoaded,
  onRefundComplete,
}: CaseInboxDetailsProps) {
  return (
    <aside className="h-full min-h-0 w-full space-y-5 overflow-y-auto border-t border-border/50 bg-muted/10 px-4 py-4 lg:w-[320px] lg:shrink-0 lg:border-l lg:border-t-0">
      {item.isOpen ? (
        <Button
          type="button"
          className="w-full"
          disabled={savePending}
          onClick={onResolve}
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Resolve
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={savePending}
          onClick={onReopen}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Reopen
        </Button>
      )}

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Customer
        </p>
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
            {inboxInitials(item.fromName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{item.fromName}</p>
            {item.fromEmail ? (
              <p className="truncate text-xs text-muted-foreground">{item.fromEmail}</p>
            ) : null}
            {item.userId ? (
              <Link
                href={`/admin/users/${item.userId}`}
                className="text-xs font-medium underline-offset-2 hover:underline"
              >
                View profile
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">Guest / no account</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/50 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Conversation
        </p>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Status
          </Label>
          <Select
            value={item.status}
            onValueChange={(value) => onStatus(value as SupportCaseStatus)}
            disabled={savePending}
          >
            <SelectTrigger className="h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKFLOW_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CaseAssigneeSelect
          backend="support_case"
          caseId={item.id}
          assigneeAdminId={item.assigneeAdminId}
          staff={staff}
          currentUserId={currentStaffId}
          onAssigned={onAssigned}
        />

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <p className="text-muted-foreground">SLA</p>
          <p
            className={cn(
              "text-right font-medium",
              item.slaState === "overdue"
                ? "text-destructive"
                : item.slaState === "due_soon"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-foreground",
            )}
          >
            {item.isOpen ? item.slaLabel || "On track" : "Closed"}
          </p>
          <p className="text-muted-foreground">Channel</p>
          <p className="text-right text-foreground">{item.channelLabel}</p>
          <p className="text-muted-foreground">Opened</p>
          <p className="text-right tabular-nums text-foreground">
            {format(new Date(item.createdAt), "MMM d, yyyy")}
          </p>
          <p className="text-muted-foreground">ID</p>
          <p className="text-right font-mono text-[11px] text-foreground">
            {formatSupportCaseReference(item.id)}
          </p>
        </div>
      </section>

      {item.order ? (
        <div className="space-y-2 border-t border-border/50 pt-4">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Outcome
          </Label>
          <Select value={osOutcome} onValueChange={onOrderOutcome} disabled={savePending}>
            <SelectTrigger className="h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {OUTCOME_OPTIONS.map((outcome) => (
                <SelectItem key={outcome.value} value={outcome.value}>
                  {outcome.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-border/50 pt-4">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Pinned note
        </Label>
        <Textarea
          value={pinnedNote}
          onChange={(e) => onPinnedNote(e.target.value)}
          onBlur={onPinnedNoteBlur}
          rows={3}
          placeholder="Summary for the next teammate…"
          className="resize-y bg-background text-sm"
        />
      </div>

      {item.orderId ? (
        <CaseOrderContextPanel
          orderId={item.orderId}
          orderSupportRequestId={item.order?.id ?? null}
          onLoaded={onOrderContextLoaded}
        />
      ) : null}

      {item.order && orderContext && item.orderId === orderContext.id ? (
        <CaseIssueRefundPanel
          caseId={item.id}
          orderId={orderContext.id}
          orderRef={item.orderRef ?? orderContext.order_num ?? item.id}
          orderStatus={orderContext.status}
          amount={orderContext.amount}
          shippingAmount={orderContext.shipping_amount}
          paymentMethod={orderContext.payment_method}
          repairCreditTotal={item.order.repair_credit_total}
          canIssueRefund={isAdmin}
          onComplete={onRefundComplete}
        />
      ) : null}

      {item.kind === "protection_claim" && item.order && item.orderId ? (
        <ProtectionClaimDesk
          orderSupportRequestId={item.order.id}
          orderId={item.orderId}
          initialCarrierClaimStatus={item.order.carrier_claim_status}
          initialCarrierClaimId={item.order.carrier_claim_id}
          initialCarrierClaimUrl={item.order.carrier_claim_url}
          initialInsuranceClaimUrl={item.order.insurance_claim_url}
          initialRepairCreditTotal={item.order.repair_credit_total}
        />
      ) : null}
    </aside>
  )
}
