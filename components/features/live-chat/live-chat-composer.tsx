"use client"

import { ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LiveChatComposerProps {
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  sending: boolean
  emailDraft?: string
  onEmailDraftChange?: (value: string) => void
  showEmailField?: boolean
  /** After the visitor confirms an email, keep it visible but not editable. */
  emailLocked?: boolean
  emailError?: string | null
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  emailInputRef?: React.RefObject<HTMLInputElement | null>
}

function resizeComposer(el: HTMLTextAreaElement) {
  el.style.height = "auto"
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

export function LiveChatComposer({
  draft,
  onDraftChange,
  onSend,
  sending,
  emailDraft = "",
  onEmailDraftChange,
  showEmailField = false,
  emailLocked = false,
  emailError = null,
  inputRef,
  emailInputRef,
}: LiveChatComposerProps) {
  const canSend = draft.trim().length > 0 && !sending

  return (
    <div className="border-t border-border/50 bg-background px-3 pb-3 pt-2">
      {emailError ? <p className="mb-2 text-xs text-destructive">{emailError}</p> : null}
      <div className="relative rounded-2xl border border-border/70 bg-card shadow-sm transition-shadow focus-within:border-listingHeart/40 focus-within:ring-2 focus-within:ring-listingHeart/10">
        {showEmailField ? (
          <input
            ref={emailInputRef}
            type="email"
            value={emailDraft}
            onChange={(e) => {
              if (emailLocked) return
              onEmailDraftChange?.(e.target.value)
            }}
            placeholder="Your email"
            aria-label="Email for replies"
            autoComplete="email"
            readOnly={emailLocked}
            aria-readonly={emailLocked}
            tabIndex={emailLocked ? -1 : undefined}
            className={cn(
              "w-full border-0 border-b border-border/60 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-0",
              emailLocked
                ? "cursor-default text-muted-foreground"
                : "text-foreground",
            )}
          />
        ) : null}
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            onDraftChange(e.target.value)
            resizeComposer(e.currentTarget)
          }}
          placeholder="Write your message…"
          rows={1}
          maxLength={10000}
          className="max-h-[120px] min-h-[44px] w-full resize-none border-0 bg-transparent px-4 py-3 pr-14 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              if (canSend) onSend()
            }
          }}
        />
        <div className="absolute bottom-1.5 right-1.5">
          <Button
            type="button"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full shadow-sm transition-colors",
              canSend
                ? "bg-listingHeart text-white hover:bg-listingHeart/90"
                : "bg-muted text-muted-foreground",
            )}
            disabled={!canSend}
            onClick={onSend}
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
