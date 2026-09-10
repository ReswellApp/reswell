"use client"

import type { Ref } from "react"
import Link from "next/link"
import { ExternalLink, Package, User } from "lucide-react"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import {
  firstNonEmptyText,
  type CaseInboxItem,
  type CaseInboxPriority,
} from "@/lib/admin/case-inbox"
import type { CaseOrderLabelContext } from "@/lib/admin/admin-order-capabilities"
import type { SupportCaseStatus } from "@/lib/types/supportCase"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import { CaseInboxBriefing } from "@/components/features/admin/case-inbox-briefing"
import { CaseInboxCommandBar } from "@/components/features/admin/case-inbox-command-bar"
import { SupportCaseThread } from "@/components/features/support/support-case-thread"
import {
  CaseInboxComposer,
  type CaseInboxComposerHandle,
  type ComposerDisposition,
  type ComposerMode,
} from "@/components/features/admin/case-inbox-composer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"
import { supportCaseResponseHref } from "@/lib/utils/support-case-paths"

interface CaseInboxConversationProps {
  item: CaseInboxItem
  messages: SupportCaseThreadMessage[]
  threadCaseId: string
  staffNames: Record<string, string>
  currentStaffId: string | null
  composerRef: Ref<CaseInboxComposerHandle>
  mode: ComposerMode
  draft: string
  pending: boolean
  savePending: boolean
  orderContext: AdminOrderDetail | null
  orderExtras: CaseOrderLabelContext | null
  onBack: () => void
  onTake: () => void
  onStatus: (status: SupportCaseStatus) => void
  onPriority: (priority: CaseInboxPriority) => void
  onResolve: () => void
  onModeChange: (mode: ComposerMode) => void
  onDraftChange: (value: string) => void
  onInsertMacro: (text: string) => void
  onSend: (disposition: ComposerDisposition) => void
}

function kindBadge(item: CaseInboxItem): string {
  if (item.kind === "protection_claim") return "Claim"
  if (item.kind === "cancel_request") return "Cancel"
  if (item.backend === "order_support") return "Order"
  return item.channelLabel
}

export function CaseInboxConversation({
  item,
  messages,
  threadCaseId,
  staffNames,
  currentStaffId,
  composerRef,
  mode,
  draft,
  pending,
  savePending,
  onBack,
  onTake,
  onStatus,
  onPriority,
  onResolve,
  onModeChange,
  onDraftChange,
  onInsertMacro,
  onSend,
  orderContext,
  orderExtras,
}: CaseInboxConversationProps) {
  const kindFilter =
    item.kind === "protection_claim"
      ? "protection_claim"
      : item.kind === "cancel_request"
        ? "cancel_request"
        : null

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <button
            type="button"
            className="text-xs text-muted-foreground md:hidden"
            onClick={onBack}
          >
            ← Inbox
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-normal">
              {kindBadge(item)}
            </Badge>
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatSupportCaseReference(item.id)}
            </span>
          </div>
          <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
            {item.subject}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {item.fromName}
            {item.fromEmail ? ` · ${item.fromEmail}` : null}
            {item.orderRef ? ` · #${item.orderRef}` : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {item.userId ? (
            <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
              <Link href={`/admin/users/${item.userId}`} aria-label="Open customer profile">
                <User className="h-4 w-4" />
                <span className="ml-1.5 hidden xl:inline">Customer</span>
              </Link>
            </Button>
          ) : null}
          {item.orderId ? (
            <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
              <Link href={`/admin/orders/${item.orderId}`} aria-label="Open order">
                <Package className="h-4 w-4" />
                <span className="ml-1.5 hidden xl:inline">Order</span>
              </Link>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link
              href={supportCaseResponseHref(item.id)}
              target="_blank"
              aria-label="See the customer’s view of this case"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="ml-1.5 hidden xl:inline">Customer view</span>
            </Link>
          </Button>
        </div>
      </header>

      <CaseInboxCommandBar
        item={item}
        currentStaffId={currentStaffId}
        assigneeName={
          item.assigneeAdminId
            ? staffNames[item.assigneeAdminId] ?? null
            : null
        }
        pending={savePending}
        onTake={onTake}
        onStatus={onStatus}
        onPriority={onPriority}
        onResolve={onResolve}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CaseInboxBriefing
          item={item}
          messages={messages}
          order={orderContext && item.orderId === orderContext.id ? orderContext : null}
          extras={orderContext && item.orderId === orderContext.id ? orderExtras : null}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3">
          <SupportCaseThread
            key={item.key}
            caseId={threadCaseId}
            messages={messages}
            canReply={false}
            role="staff"
            closed={!item.isOpen}
            staffNames={staffNames}
            originalRequest={{
              body: firstNonEmptyText(item.order?.body, item.contact?.message, item.preview),
              createdAt: item.createdAt,
              name: item.fromName,
            }}
          />
        </div>
        <div className="shrink-0 border-t border-border/50 bg-background/95 px-3 py-3 backdrop-blur-sm">
          <CaseInboxComposer
            ref={composerRef}
            mode={mode}
            draft={draft}
            pending={pending}
            closed={!item.isOpen}
            kindFilter={kindFilter}
            vars={{ order_ref: item.orderRef ?? undefined, name: item.fromName }}
            onModeChange={onModeChange}
            onDraftChange={onDraftChange}
            onInsertMacro={onInsertMacro}
            onSend={onSend}
          />
        </div>
      </div>
    </div>
  )
}
