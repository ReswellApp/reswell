"use client"

import { forwardRef, useImperativeHandle, useRef } from "react"
import { Loader2 } from "lucide-react"
import { SupportMacrosPicker } from "@/components/features/admin/support-macros-picker"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type ComposerMode = "reply" | "note"

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
  vars: { name?: string; order_ref?: string }
  onModeChange: (mode: ComposerMode) => void
  onDraftChange: (value: string) => void
  onInsertMacro: (text: string) => void
  onSend: (closeAfter: boolean) => void
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
      onModeChange,
      onDraftChange,
      onInsertMacro,
      onSend,
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
          "rounded-2xl border px-3 py-2.5 shadow-lg shadow-black/10",
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
        {closed && mode === "reply" ? (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
            This conversation is closed. Switch to Note for a staff-only comment.
          </p>
        ) : (
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim()) {
                e.preventDefault()
                onSend(false)
              }
            }}
            rows={3}
            maxLength={12000}
            placeholder={
              mode === "note"
                ? "Add a private note for the team…"
                : "Write a reply the customer will see…"
            }
            className="resize-none bg-background text-sm"
          />
        )}
        {closed && mode === "reply" ? null : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SupportMacrosPicker
              variant="menu"
              kindFilter={kindFilter}
              vars={vars}
              onInsert={onInsertMacro}
            />
            <div className="ml-auto flex flex-wrap gap-2">
              {mode === "reply" && !closed ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending || !draft.trim()}
                  onClick={() => onSend(true)}
                >
                  Send and close
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={pending || !draft.trim()}
                onClick={() => onSend(false)}
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
