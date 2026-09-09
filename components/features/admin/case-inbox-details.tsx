"use client"

import Link from "next/link"
import { format } from "date-fns"
import { CheckCircle2, RotateCcw } from "lucide-react"
import type { OrderSupportOutcome } from "@/lib/db/order-support"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import type { SupportCaseEventRow } from "@/lib/db/supportCases"
import type { SupportCaseCustomerOrder } from "@/lib/services/supportCaseCustomerContext"
import type { CaseOrderLabelContext } from "@/lib/admin/admin-order-capabilities"
import type { StaffAssigneeRow } from "@/lib/db/searchInsightActions"
import type { CaseInboxItem, CaseInboxPriority } from "@/lib/admin/case-inbox"
import type { SupportCaseStatus } from "@/lib/types/supportCase"
import { CaseAssigneeSelect } from "@/components/features/admin/case-assignee-select"
import { CaseActivityTimeline } from "@/components/features/admin/case-activity-timeline"
import { CaseCustomerContext } from "@/components/features/admin/case-customer-context"
import { CaseSellerContactCard } from "@/components/features/admin/case-seller-contact-card"
import { AdminIssueItemReturnPanel } from "@/components/features/admin/admin-issue-item-return-panel"
import { CaseIssueRefundPanel } from "@/components/features/admin/case-issue-refund-panel"
import { CaseOrderContextPanel } from "@/components/features/admin/case-order-context-panel"
import { ProtectionClaimDesk } from "@/components/features/admin/protection-claim-desk"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

const PRIORITY_OPTIONS: { value: CaseInboxPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
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
  events: SupportCaseEventRow[]
  staffNames: Record<string, string>
  onAssigned: (id: string | null) => void
  onStatus: (status: SupportCaseStatus) => void
  onPriority: (priority: CaseInboxPriority) => void
  onResolve: () => void
  onReopen: () => void
  onOrderOutcome: (outcome: string) => void
  onPinnedNote: (note: string) => void
  onPinnedNoteBlur: () => void
  onOrderContextLoaded: (detail: AdminOrderDetail, extras: CaseOrderLabelContext) => void
  onOrderLinked: (order: SupportCaseCustomerOrder) => void
  onSellerOutreachSent: () => void
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
  events,
  staffNames,
  onAssigned,
  onStatus,
  onPriority,
  onResolve,
  onReopen,
  onOrderOutcome,
  onPinnedNote,
  onPinnedNoteBlur,
  onOrderContextLoaded,
  onOrderLinked,
  onSellerOutreachSent,
  onRefundComplete,
}: CaseInboxDetailsProps) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-t border-border/50 bg-muted/10 lg:w-[400px] lg:shrink-0 lg:border-l lg:border-t-0">
      <div className="shrink-0 border-b border-border/50 px-4 py-3">
        {item.isOpen ? (
          <Button type="button" className="w-full" disabled={savePending} onClick={onResolve}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Resolve conversation
          </Button>
        ) : (
          <Button type="button" variant="outline" className="w-full" disabled={savePending} onClick={onReopen}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reopen conversation
          </Button>
        )}
      </div>

      <Tabs
        key={item.key}
        defaultValue={item.kind === "protection_claim" ? "claim" : "overview"}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="mx-3 mt-3 grid h-9 shrink-0 grid-cols-4">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="order" className="text-xs">Order</TabsTrigger>
          <TabsTrigger value="claim" className="text-xs">Claim</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-5 pt-3">
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                {inboxInitials(item.fromName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{item.fromName}</p>
                {item.fromEmail ? <p className="truncate text-xs text-muted-foreground">{item.fromEmail}</p> : null}
                {item.userId ? (
                  <Link href={`/admin/users/${item.userId}`} className="text-xs font-medium underline-offset-2 hover:underline">
                    View complete profile
                  </Link>
                ) : <p className="text-xs text-muted-foreground">Guest / no account</p>}
              </div>
            </div>
          </section>

          <section className="space-y-2 border-t border-border/50 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Customer activity
            </p>
            <CaseCustomerContext
              caseId={item.id}
              linkedOrderId={item.orderId}
              onOrderLinked={onOrderLinked}
            />
          </section>

          <section className="space-y-3 border-t border-border/50 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Workflow</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Status</Label>
                <Select value={item.status} onValueChange={(value) => onStatus(value as SupportCaseStatus)} disabled={savePending}>
                  <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_STATUSES.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Priority</Label>
                <Select value={item.priority} onValueChange={(value) => onPriority(value as CaseInboxPriority)} disabled={savePending}>
                  <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((priority) => <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <CaseAssigneeSelect backend="support_case" caseId={item.id} assigneeAdminId={item.assigneeAdminId} staff={staff} currentUserId={currentStaffId} onAssigned={onAssigned} />

            <div className="rounded-lg border border-border/60 bg-background p-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <p className="text-muted-foreground">SLA</p>
                <p className={cn("text-right font-semibold", item.slaState === "overdue" ? "text-destructive" : item.slaState === "due_soon" ? "text-amber-700 dark:text-amber-300" : "text-foreground")}>
                  {item.isOpen ? item.slaLabel || "On track" : "Closed"}
                </p>
                <p className="text-muted-foreground">Channel</p><p className="text-right">{item.channelLabel}</p>
                <p className="text-muted-foreground">Opened</p><p className="text-right tabular-nums">{format(new Date(item.createdAt), "MMM d, yyyy")}</p>
                <p className="text-muted-foreground">ID</p><p className="text-right font-mono text-[11px]">{formatSupportCaseReference(item.id)}</p>
              </div>
            </div>
          </section>

          <div className="space-y-2 border-t border-border/50 pt-4">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Pinned teammate summary</Label>
            <Textarea value={pinnedNote} onChange={(e) => onPinnedNote(e.target.value)} onBlur={onPinnedNoteBlur} rows={4} placeholder="Key context, promises, or next step…" className="resize-y bg-background text-sm" />
          </div>
        </TabsContent>

        <TabsContent value="order" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-5 pt-3">
          {item.orderId ? (
            <>
              {item.order ? (
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Case outcome</Label>
                  <Select value={osOutcome} onValueChange={onOrderOutcome} disabled={savePending}>
                    <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {OUTCOME_OPTIONS.map((outcome) => <SelectItem key={outcome.value} value={outcome.value}>{outcome.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {orderContext && item.orderId === orderContext.id ? (
                <CaseSellerContactCard
                  key={orderContext.id}
                  sourceCaseId={item.id}
                  orderRef={item.orderRef ?? orderContext.order_num ?? orderContext.id.slice(0, 8)}
                  caseKind={item.kind}
                  issueSummary={item.order?.body ?? item.contact?.message ?? item.preview}
                  seller={orderContext.seller}
                  onOutreachSent={onSellerOutreachSent}
                />
              ) : null}
              <CaseOrderContextPanel orderId={item.orderId} orderSupportRequestId={item.order?.id ?? null} onLoaded={onOrderContextLoaded} />
              <AdminIssueItemReturnPanel orderId={item.orderId} canIssue={isAdmin} variant="embedded" onComplete={onRefundComplete} />
              {item.order && orderContext && item.orderId === orderContext.id ? (
                <CaseIssueRefundPanel caseId={item.id} orderId={orderContext.id} orderRef={item.orderRef ?? orderContext.order_num ?? item.id} orderStatus={orderContext.status} amount={orderContext.amount} shippingAmount={orderContext.shipping_amount} paymentMethod={orderContext.payment_method} repairCreditTotal={item.order.repair_credit_total} canIssueRefund={isAdmin} onComplete={onRefundComplete} />
              ) : null}
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">This conversation is not linked to an order.</p>
          )}
        </TabsContent>

        <TabsContent value="claim" className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3">
          {item.kind === "protection_claim" && item.order && item.orderId ? (
            <ProtectionClaimDesk orderSupportRequestId={item.order.id} orderId={item.orderId} initialCarrierClaimStatus={item.order.carrier_claim_status} initialCarrierClaimId={item.order.carrier_claim_id} initialCarrierClaimUrl={item.order.carrier_claim_url} initialInsuranceClaimUrl={item.order.insurance_claim_url} initialRepairCreditTotal={item.order.repair_credit_total} />
          ) : (
            <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">Claim tools appear here for Purchase Protection cases.</p>
          )}
        </TabsContent>

        <TabsContent value="history" className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
          <CaseActivityTimeline events={events} staffNames={staffNames} />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
