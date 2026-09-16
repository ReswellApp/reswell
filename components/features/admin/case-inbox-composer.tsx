"use client"

import { forwardRef, useImperativeHandle, useRef } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import {
  supportReplyExampleRatingClass,
  supportReplyExampleRatingLabel,
} from "@/components/features/admin/support-reply-examples/support-reply-example-rating"
import { SUPPORT_REPLY_DRAFT_RATINGS, type SupportReplyDraftRating } from "@/lib/validations/supportReplyDraft"
import { SupportMacrosPicker } from "@/components/features/admin/support-macros-picker"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type {
  SupportReplyCitedHelp,
  SupportReplyCitedOrder,
  SupportReplyCitedTicket,
} from "@/lib/types/supportReplyDraft"
import type { SupportMacroVars } from "@/lib/utils/apply-support-macro-vars"

export type ComposerMode = "reply" | "note"
export type ComposerDisposition = "keep_open" | "waiting" | "resolve"

export type CaseInboxComposerHandle = {
  focus: () => void
  setMode: (mode: ComposerMode) => void
}

interface CaseInboxComposerProps {
  mode: ComposerMode
  draft: string
  pending: boolean
  closed: boolean
  kindFilter: string | null
  vars: SupportMacroVars
  orderVarsReady?: boolean
  hasOrderVars?: boolean
  replyPlaceholder?: string
  onModeChange: (mode: ComposerMode) => void
  onDraftChange: (value: string) => void
  rewritePrompt?: string
  onRewritePromptChange?: (value: string) => void
  onInsertMacro: (text: string) => void
  onSend: (disposition: ComposerDisposition) => void
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

export const CaseInboxComposer = forwardRef<CaseInboxComposerHandle, CaseInboxComposerProps>(
  function CaseInboxComposer(
    {
      mode,
      draft,
      pending,
      closed,
      kindFilter,
      vars,
      orderVarsReady = true,
      hasOrderVars = true,
      replyPlaceholder = "Write a reply they will see…",
      onModeChange,
      onDraftChange,
      rewritePrompt = "",
      onRewritePromptChange,
      onInsertMacro,
      onSend,
      aiLoading = false,
      aiActive = false,
      aiError = null,
      aiHelp = [],
      aiReason = null,
      aiOrders = [],
      aiTickets = [],
      onRegenerateAi,
      onRateAi,
      aiRating = null,
      aiRatingPending = false,
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      setMode: (next) => onModeChange(next),
    }))

    return (
      <div
        className={cn(
          "rounded-xl border px-3 py-2",
          mode === "note"
            ? "border-amber-200/80 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40"
            : "border-border/70 bg-background",
        )}
      >
        <div className="mb-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onModeChange("reply")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              mode === "reply" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Reply
          </button>
          <button
            type="button"
            onClick={() => onModeChange("note")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              mode === "note"
                ? "bg-amber-700 text-white dark:bg-amber-600"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Note
          </button>
          <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
            {mode === "note" ? "Staff only · not emailed" : "⌘↵ to send"}
          </span>
        </div>
        {mode === "reply" && !closed ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3" aria-hidden />
            <span>
              {aiLoading
                ? "Reswell agent is writing…"
                : aiError
                  ? aiError
                  : aiActive
                    ? "Reswell agent draft — edit or delete to write freeform"
                    : "Write freeform, or prompt the agent and rewrite"}
            </span>
            {onRegenerateAi ? (
              <button
                type="button"
                onClick={onRegenerateAi}
                disabled={aiLoading || pending}
                className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3 w-3", aiLoading && "animate-spin")} />
                Rewrite
              </button>
            ) : null}
            {aiActive && onRateAi
              ? SUPPORT_REPLY_DRAFT_RATINGS.map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => onRateAi(rating)}
                    disabled={aiRatingPending}
                    aria-pressed={aiRating === rating}
                    className={cn(
                      "inline-flex items-center rounded-md px-1.5 py-0.5 font-medium disabled:opacity-50",
                      supportReplyExampleRatingClass(rating, aiRating === rating),
                    )}
                    aria-label={`Rate this draft ${supportReplyExampleRatingLabel(rating).toLowerCase()}`}
                  >
                    {supportReplyExampleRatingLabel(rating)}
                  </button>
                ))
              : null}
            {aiActive && aiReason ? (
              <span className="w-full pl-4 text-[10px] text-muted-foreground">{aiReason}</span>
            ) : null}
            {aiActive && (aiHelp[0] || aiOrders[0] || aiTickets[0]) ? (
              <span className="w-full truncate pl-4 text-[10px]">
                {[
                  ...aiOrders.map((order) => `Order ${order.orderRef}`),
                  ...aiTickets.map((ticket) => ticket.subject),
                  ...aiHelp.map((article) => article.title),
                ].join(" · ")}
              </span>
            ) : null}
          </div>
        ) : null}
        {mode === "reply" && !closed && onRewritePromptChange ? (
          <label className="mb-2 block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Prompt</span>
            <Textarea
              value={rewritePrompt}
              onChange={(e) => onRewritePromptChange(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Tell the agent how to write this reply — tone, what to offer, what to skip…"
              className="min-h-[56px] resize-none bg-muted/40 text-sm"
            />
          </label>
        ) : null}
        {closed && mode === "reply" ? (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
            This conversation is closed. Switch to Note for a staff-only comment.
          </p>
        ) : (
          <label className="block">
            {mode === "reply" ? (
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Reply</span>
            ) : null}
            <Textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim()) {
                  e.preventDefault()
                  onSend("keep_open")
                }
              }}
              rows={2}
              maxLength={12000}
              placeholder={
                mode === "note"
                  ? "Add a private note for the team…"
                  : replyPlaceholder
              }
              className="resize-none bg-background text-sm"
            />
          </label>
        )}
        {closed && mode === "reply" ? null : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SupportMacrosPicker
              variant="menu"
              kindFilter={kindFilter}
              vars={vars}
              orderVarsReady={orderVarsReady}
              hasOrderVars={hasOrderVars}
              onInsert={onInsertMacro}
            />
            <div className="ml-auto flex flex-wrap gap-2">
              {mode === "reply" && !closed ? (
                <>
                  <Button type="button" size="sm" variant="outline" disabled={pending || !draft.trim()} onClick={() => onSend("waiting")}>
                    Send &amp; wait
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={pending || !draft.trim()} onClick={() => onSend("resolve")}>
                    Send &amp; resolve
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={pending || !draft.trim()}
                onClick={() => onSend("keep_open")}
              >
                {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {mode === "note" ? "Add note" : "Send"}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  },
)
