"use client"

import type { Ref } from "react"
import Link from "next/link"
import { CheckCircle2, ExternalLink, Package, PanelRight, User } from "lucide-react"
import {
  firstNonEmptyText,
  inboxInitials,
  type CaseInboxItem,
  type CaseInboxPriority,
} from "@/lib/admin/case-inbox"
import type { SupportCaseStatus } from "@/lib/types/supportCase"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import type { StaffAssigneeRow } from "@/lib/db/searchInsightActions"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import type { CaseOrderLabelContext } from "@/lib/admin/admin-order-capabilities"
import { CaseInboxBriefing } from "@/components/features/admin/case-inbox-briefing"
import { CaseInboxCommandBar } from "@/components/features/admin/case-inbox-command-bar"
import { CaseInboxWalletCredit } from "@/components/features/admin/case-inbox-wallet-credit"
import { SupportCaseThread } from "@/components/features/support/support-case-thread"
import {
  CaseInboxComposer,
  type CaseInboxComposerHandle,
  type ComposerDisposition,
  type ComposerMode,
} from "@/components/features/admin/case-inbox-composer"
import type {
  SupportReplyCitedHelp,
  SupportReplyCitedOrder,
  SupportReplyCitedTicket,
} from "@/lib/types/supportReplyDraft"
import type { SupportReplyDraftRating } from "@/lib/validations/supportReplyDraft"
import { Button } from "@/components/ui/button"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"
import { supportCaseResponseHref } from "@/lib/utils/support-case-paths"
import {
  inboxCounterpartLabel,
  staffReplyPlaceholder,
  staffWorkflowStatusLabel,
} from "@/lib/admin/case-inbox-counterpart"
import { supportMacroVarsFromOrder } from "@/lib/utils/support-macro-order-vars"
import { useSupportMacroOrder } from "@/components/features/admin/support-macros/use-support-macro-order"
import { cn } from "@/lib/utils"

interface CaseInboxConversationProps {
  item: CaseInboxItem
  messages: SupportCaseThreadMessage[]
  threadCaseId: string
  staff: StaffAssigneeRow[]
  staffNames: Record<string, string>
  currentStaffId: string | null
  canCreditWallet?: boolean
  composerRef: Ref<CaseInboxComposerHandle>
  mode: ComposerMode
  draft: string
  pending: boolean
  savePending: boolean
  onBack: () => void
  onOpenDetails?: () => void
  detailsOpen?: boolean
  onTake: () => void
  onAssigned: (id: string | null) => void
  onStatus: (status: SupportCaseStatus) => void
  onPriority: (priority: CaseInboxPriority) => void
  onResolve: () => void
  onModeChange: (mode: ComposerMode) => void
  onDraftChange: (value: string) => void
  rewritePrompt?: string
  onRewritePromptChange?: (value: string) => void
  onInsertMacro: (text: string) => void
  onSend: (disposition: ComposerDisposition) => void
  onWalletCredited?: () => void
  orderContext?: AdminOrderDetail | null
  orderExtras?: CaseOrderLabelContext | null
  aiLoading?: boolean
  aiActive?: boolean
  aiError?: string | null
  aiHelp?: SupportReplyCitedHelp[]
  aiReason?: string | null
  aiOrders?: SupportReplyCitedOrder[]
  aiTickets?: SupportReplyCitedTicket[]
  onRegenerateAi?: () => void
  onRateAi?: (rating: SupportReplyDraftRating) => void
  aiRating?: SupportReplyDraftRating | null
  aiRatingPending?: boolean
}

export function CaseInboxConversation({
  item,
  messages,
  threadCaseId,
  staff,
  staffNames,
  currentStaffId,
  canCreditWallet = false,
  composerRef,
  mode,
  draft,
  pending,
  savePending,
  onBack,
  onOpenDetails,
  detailsOpen = false,
  onTake,
  onAssigned,
  onStatus,
  onPriority,
  onResolve,
  onModeChange,
  onDraftChange,
  rewritePrompt = "",
  onRewritePromptChange,
  onInsertMacro,
  onSend,
  onWalletCredited,
  orderContext = null,
  orderExtras = null,
  aiLoading,
  aiActive,
  aiError,
  aiHelp,
  aiReason,
  aiOrders,
  aiTickets,
  onRegenerateAi,
  onRateAi,
  aiRating,
  aiRatingPending,
}: CaseInboxConversationProps) {
  const linkedOrder = orderContext && item.orderId === orderContext.id ? orderContext : null
  const { order: macroOrder, ready: orderVarsReady } = useSupportMacroOrder(
    item.orderId,
    linkedOrder,
  )
  const macroVars = supportMacroVarsFromOrder({
    name: item.fromName,
    order_ref: item.orderRef,
    order: macroOrder,
  })
  const statusLabel = staffWorkflowStatusLabel(item.status, item)

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border/50 px-3 pb-3 pt-3 md:px-5 md:pt-4">
        <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
          <button
            type="button"
            className="inline-flex min-h-9 items-center text-sm font-medium text-muted-foreground"
            onClick={onBack}
          >
            ← Inbox
          </button>
          {onOpenDetails ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center text-sm font-medium text-foreground"
              onClick={onOpenDetails}
            >
              Customer
            </button>
          ) : null}
        </div>
        <div className="flex items-start justify-between gap-2 md:gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                item.isNew
                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-100"
                  : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {inboxInitials(item.fromName)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="truncate text-base font-semibold tracking-tight text-foreground md:text-[17px]">
                  {item.fromName}
                </h2>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    item.isOpen
                      ? item.status === "waiting_on_you"
                        ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
                        : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {statusLabel}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-sm text-foreground/85">{item.subject}</p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {formatSupportCaseReference(item.id)}
                {item.fromEmail ? ` · ${item.fromEmail}` : null}
                {item.orderRef ? ` · Order ${item.orderRef}` : null}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 md:gap-1">
            {canCreditWallet && item.userId ? (
              <CaseInboxWalletCredit
                userId={item.userId}
                displayName={item.fromName}
                email={item.fromEmail}
                supportCaseId={item.id}
                variant="icon"
                onCredited={onWalletCredited}
              />
            ) : null}
            {item.userId ? (
              <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                <Link href={`/admin/users/${item.userId}`} aria-label={`Open ${inboxCounterpartLabel(item.requesterRole).toLowerCase()} profile`}>
                  <User className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            {item.orderId ? (
              <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                <Link href={`/admin/orders/${item.orderId}`} aria-label="Open order">
                  <Package className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
              <Link
                href={supportCaseResponseHref(item.id)}
                target="_blank"
                aria-label={`See the ${inboxCounterpartLabel(item.requesterRole).toLowerCase()}’s view of this case`}
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
            {onOpenDetails ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("hidden h-8 px-2 md:inline-flex", detailsOpen && "bg-muted")}
                onClick={onOpenDetails}
                aria-label={detailsOpen ? "Hide customer details" : "Show customer details"}
                aria-pressed={detailsOpen}
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <CaseInboxCommandBar
        item={item}
        staff={staff}
        currentStaffId={currentStaffId}
        pending={savePending}
        onTake={onTake}
        onAssigned={onAssigned}
        onStatus={onStatus}
        onPriority={onPriority}
      />

      {item.isOpen ? (
        <div className="shrink-0 px-3 pb-2 pt-2 md:px-5">
          <Button type="button" className="h-9 w-full" disabled={savePending} onClick={onResolve}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Resolve conversation
          </Button>
        </div>
      ) : null}

      <CaseInboxBriefing
        item={item}
        messages={messages}
        order={linkedOrder}
        extras={orderExtras}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 md:px-4">
          <SupportCaseThread
            caseId={threadCaseId}
            messages={messages}
            canReply={false}
            role="staff"
            closed={!item.isOpen}
            staffNames={staffNames}
            requesterUserId={item.userId}
            counterpartLabel={item.fromName}
            originalRequest={
              item.openedBy === "staff"
                ? null
                : {
                    // Never fall back to item.preview — it becomes the staff reply after send.
                    body: firstNonEmptyText(
                      item.order?.body,
                      item.contact?.message,
                      messages.find(
                        (message) =>
                          message.author_role === "customer" && !message.is_internal,
                      )?.body,
                    ),
                    createdAt: item.createdAt,
                    name: item.fromName,
                  }
            }
          />
        </div>
        <div className="shrink-0 border-t border-border/40 bg-background px-3 py-3 md:px-4">
          <CaseInboxComposer
            ref={composerRef}
            mode={mode}
            draft={draft}
            pending={pending}
            closed={!item.isOpen}
            kindFilter={item.kind}
            vars={macroVars}
            orderVarsReady={orderVarsReady}
            hasOrderVars={macroOrder !== null}
            replyPlaceholder={
              aiLoading ? "Reswell agent is writing a reply…" : staffReplyPlaceholder(item.requesterRole)
            }
            onModeChange={onModeChange}
            onDraftChange={onDraftChange}
            rewritePrompt={rewritePrompt}
            onRewritePromptChange={onRewritePromptChange}
            onInsertMacro={onInsertMacro}
            onSend={onSend}
            aiLoading={aiLoading}
            aiActive={aiActive}
            aiError={aiError}
            aiHelp={aiHelp}
            aiReason={aiReason}
            aiOrders={aiOrders}
            aiTickets={aiTickets}
            onRegenerateAi={onRegenerateAi}
            onRateAi={onRateAi}
            aiRating={aiRating}
            aiRatingPending={aiRatingPending}
          />
        </div>
      </div>
    </div>
  )
}
