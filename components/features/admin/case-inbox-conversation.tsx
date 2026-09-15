"use client"

import type { Ref } from "react"
import Link from "next/link"
import { CheckCircle2, ExternalLink, Package, User } from "lucide-react"
import {
  firstNonEmptyText,
  type CaseInboxItem,
  type CaseInboxPriority,
} from "@/lib/admin/case-inbox"
import type { SupportCaseStatus } from "@/lib/types/supportCase"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import type { StaffAssigneeRow } from "@/lib/db/searchInsightActions"
import { CaseInboxCommandBar } from "@/components/features/admin/case-inbox-command-bar"
import { SupportCaseThread } from "@/components/features/support/support-case-thread"
import {
  CaseInboxComposer,
  type CaseInboxComposerHandle,
  type ComposerDisposition,
  type ComposerMode,
} from "@/components/features/admin/case-inbox-composer"
import type { SupportReplyCitedHelp } from "@/lib/types/supportReplyDraft"
import { Button } from "@/components/ui/button"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"
import { supportCaseResponseHref } from "@/lib/utils/support-case-paths"
import {
  inboxCounterpartLabel,
  staffReplyPlaceholder,
} from "@/lib/admin/case-inbox-counterpart"

interface CaseInboxConversationProps {
  item: CaseInboxItem
  messages: SupportCaseThreadMessage[]
  threadCaseId: string
  staff: StaffAssigneeRow[]
  staffNames: Record<string, string>
  currentStaffId: string | null
  composerRef: Ref<CaseInboxComposerHandle>
  mode: ComposerMode
  draft: string
  pending: boolean
  savePending: boolean
  onBack: () => void
  onTake: () => void
  onAssigned: (id: string | null) => void
  onStatus: (status: SupportCaseStatus) => void
  onPriority: (priority: CaseInboxPriority) => void
  onResolve: () => void
  onModeChange: (mode: ComposerMode) => void
  onDraftChange: (value: string) => void
  onInsertMacro: (text: string) => void
  onSend: (disposition: ComposerDisposition) => void
  aiLoading?: boolean
  aiActive?: boolean
  aiError?: string | null
  aiHelp?: SupportReplyCitedHelp[]
  onRegenerateAi?: () => void
  onRateAi?: (rating: "accepted" | "rejected") => void
  aiRating?: "accepted" | "rejected" | null
  aiRatingPending?: boolean
}

export function CaseInboxConversation({
  item,
  messages,
  threadCaseId,
  staff,
  staffNames,
  currentStaffId,
  composerRef,
  mode,
  draft,
  pending,
  savePending,
  onBack,
  onTake,
  onAssigned,
  onStatus,
  onPriority,
  onResolve,
  onModeChange,
  onDraftChange,
  onInsertMacro,
  onSend,
  aiLoading,
  aiActive,
  aiError,
  aiHelp,
  onRegenerateAi,
  onRateAi,
  aiRating,
  aiRatingPending,
}: CaseInboxConversationProps) {
  const kindFilter =
    item.kind === "protection_claim"
      ? "protection_claim"
      : item.kind === "cancel_request"
        ? "cancel_request"
        : null

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="shrink-0 px-5 pt-4">
        <button
          type="button"
          className="mb-1 text-xs text-muted-foreground md:hidden"
          onClick={onBack}
        >
          ← Inbox
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Ticket {formatSupportCaseReference(item.id)}
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
              {item.subject}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {item.fromName}
              {item.fromEmail ? ` · ${item.fromEmail}` : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
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
        <div className="shrink-0 px-5 pb-3">
          <Button type="button" className="h-9 w-full" disabled={savePending} onClick={onResolve}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Resolve conversation
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4">
          <SupportCaseThread
            caseId={threadCaseId}
            messages={messages}
            canReply={false}
            role="staff"
            closed={!item.isOpen}
            staffNames={staffNames}
            counterpartLabel={item.fromName}
            originalRequest={
              item.openedBy === "staff"
                ? null
                : {
                    body: firstNonEmptyText(item.order?.body, item.contact?.message, item.preview),
                    createdAt: item.createdAt,
                    name: item.fromName,
                  }
            }
          />
        </div>
        <div className="shrink-0 border-t border-border/40 bg-background px-4 py-3">
          <CaseInboxComposer
            ref={composerRef}
            mode={mode}
            draft={draft}
            pending={pending}
            closed={!item.isOpen}
            kindFilter={kindFilter}
            vars={{ order_ref: item.orderRef ?? undefined, name: item.fromName }}
            replyPlaceholder={
              aiLoading ? "Reswell agent is writing a reply…" : staffReplyPlaceholder(item.requesterRole)
            }
            onModeChange={onModeChange}
            onDraftChange={onDraftChange}
            onInsertMacro={onInsertMacro}
            onSend={onSend}
            aiLoading={aiLoading}
            aiActive={aiActive}
            aiError={aiError}
            aiHelp={aiHelp}
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
