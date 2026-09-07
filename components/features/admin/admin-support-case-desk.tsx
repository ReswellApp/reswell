"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Package, User } from "lucide-react"
import { SupportCaseThread } from "@/components/features/support/support-case-thread"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import { SupportMacrosPicker } from "@/components/features/admin/support-macros-picker"
import { ProtectionClaimDesk } from "@/components/features/admin/protection-claim-desk"
import { CaseAssigneeSelect } from "@/components/features/admin/case-assignee-select"
import { CaseIssueRefundPanel } from "@/components/features/admin/case-issue-refund-panel"
import { listSupportStaffAction } from "@/lib/actions/supportCaseAssign"
import type { StaffAssigneeRow } from "@/lib/db/searchInsightActions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  SUPPORT_CASE_KIND_LABEL,
  formatSupportCaseReference,
} from "@/lib/utils/support-case-display"
import type { SupportCaseKind } from "@/lib/types/supportCase"
import { adminSupportCaseHref, supportCaseResponseHref } from "@/lib/utils/support-case-paths"
import type { CarrierClaimStatus } from "@/lib/types/protectionClaimDesk"

const CASES_INBOX_HREF = "/admin/contact-messages"

type ClaimDeskInitials = {
  orderSupportRequestId: string
  orderId: string
  initialCarrierClaimStatus: CarrierClaimStatus | null
  initialCarrierClaimId: string | null
  initialCarrierClaimUrl: string | null
  initialInsuranceClaimUrl: string | null
  initialRepairCreditTotal: number
}

type AdminSupportCaseDeskProps = {
  caseId: string
  subject: string
  kind: SupportCaseKind
  customerUserId: string | null
  customerLabel: string
  orderId: string | null
  orderRef: string | null
  preview: string
  initialStatus: string
  messages: SupportCaseThreadMessage[]
  closed?: boolean
  claimDesk?: ClaimDeskInitials | null
  assigneeAdminId?: string | null
  refund?: {
    orderStatus: string
    amount: number
    shippingAmount: number
    paymentMethod: string
    repairCreditTotal: number
  } | null
}

export function AdminSupportCaseDesk({
  caseId,
  subject,
  kind,
  customerUserId,
  customerLabel,
  orderId,
  orderRef,
  preview,
  initialStatus,
  messages,
  closed = false,
  claimDesk = null,
  assigneeAdminId: initialAssignee = null,
  refund = null,
}: AdminSupportCaseDeskProps) {
  const [assigneeAdminId, setAssigneeAdminId] = useState(initialAssignee)
  const [staff, setStaff] = useState<StaffAssigneeRow[]>([])
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [macroDraft, setMacroDraft] = useState("")

  useEffect(() => {
    void listSupportStaffAction().then((res) => {
      if ("error" in res && res.error) return
      setStaff(res.rows)
      setCurrentStaffId(res.currentUserId)
      setIsAdmin(res.isAdmin === true)
    })
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
          <Link href="/admin/contact-messages">
            <ArrowLeft className="h-4 w-4" />
            Case inbox
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {customerUserId ? (
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href={`/admin/users/${customerUserId}`}>
                <User className="mr-1.5 h-3.5 w-3.5" />
                User
              </Link>
            </Button>
          ) : null}
          {orderId ? (
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href={`/admin/orders/${orderId}`}>
                <Package className="mr-1.5 h-3.5 w-3.5" />
                Order
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href={supportCaseResponseHref(caseId)} target="_blank">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Customer view
            </Link>
          </Button>
        </div>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{SUPPORT_CASE_KIND_LABEL[kind]}</Badge>
          <Badge variant="outline">{initialStatus.replaceAll("_", " ")}</Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {formatSupportCaseReference(caseId)}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{subject}</h1>
        {orderRef ? (
          <p className="text-sm text-muted-foreground">Order {orderRef}</p>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Original request
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{preview}</p>
          </div>

          <div className="flex min-h-[28rem] flex-col rounded-[20px] border border-border/55 bg-background px-3 shadow-sm">
            {macroDraft ? (
              <p className="sr-only">{macroDraft}</p>
            ) : null}
            <div className="shrink-0 border-b border-border/50 px-1 py-3">
              <SupportMacrosPicker
                kindFilter={
                  kind === "protection_claim"
                    ? "protection_claim"
                    : kind === "cancel_request"
                      ? "cancel_request"
                      : null
                }
                vars={{ order_ref: orderRef ?? undefined, name: customerLabel }}
                onInsert={(text) => setMacroDraft(text)}
              />
              {macroDraft ? (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Macro copied below — paste it into the reply, or type your own.
                </p>
              ) : null}
              {macroDraft ? (
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  {macroDraft}
                </p>
              ) : null}
            </div>
            <SupportCaseThread
              caseId={caseId}
              messages={messages}
              canReply
              role="staff"
              closed={closed}
              seedText={macroDraft || undefined}
            />
          </div>
        </div>

        <aside className="space-y-4">
          <CaseAssigneeSelect
            backend="support_case"
            caseId={caseId}
            assigneeAdminId={assigneeAdminId}
            staff={staff}
            currentUserId={currentStaffId}
            onAssigned={setAssigneeAdminId}
          />
          {refund && orderId && orderRef ? (
            <CaseIssueRefundPanel
              caseId={caseId}
              orderId={orderId}
              orderRef={orderRef}
              orderStatus={refund.orderStatus}
              amount={refund.amount}
              shippingAmount={refund.shippingAmount}
              paymentMethod={refund.paymentMethod}
              repairCreditTotal={refund.repairCreditTotal}
              canIssueRefund={isAdmin}
            />
          ) : null}
          {claimDesk ? (
            <ProtectionClaimDesk
              orderSupportRequestId={claimDesk.orderSupportRequestId}
              orderId={claimDesk.orderId}
              initialCarrierClaimStatus={claimDesk.initialCarrierClaimStatus}
              initialCarrierClaimId={claimDesk.initialCarrierClaimId}
              initialCarrierClaimUrl={claimDesk.initialCarrierClaimUrl}
              initialInsuranceClaimUrl={claimDesk.initialInsuranceClaimUrl}
              initialRepairCreditTotal={claimDesk.initialRepairCreditTotal}
            />
          ) : null}
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Tip</p>
            <p className="mt-1 leading-relaxed">
              Inbox triage stays at{" "}
              <Link href={CASES_INBOX_HREF} className="underline underline-offset-2">
                Cases
              </Link>
              . Replies stay on this case — they never go to Messages.
            </p>
            <Button asChild type="button" size="sm" variant="ghost" className="mt-2 h-8 px-0">
              <Link href={adminSupportCaseHref(caseId)}>Refresh</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
