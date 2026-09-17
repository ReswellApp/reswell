"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  supportReplyExampleRatingLabel,
} from "@/components/features/admin/support-reply-examples/support-reply-example-rating"
import {
  SUPPORT_REPLY_DRAFT_RATINGS,
  type SupportReplyDraftRating,
} from "@/lib/validations/supportReplyDraft"

const RATING_BUTTON_CLASS: Record<SupportReplyDraftRating, string> = {
  very_good:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-200",
  okay: "border-amber-500/40 bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 dark:text-amber-200",
  bad: "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
}

const RATING_SELECTED_CLASS: Record<SupportReplyDraftRating, string> = {
  very_good: "ring-2 ring-emerald-500/50 border-emerald-500",
  okay: "ring-2 ring-amber-500/50 border-amber-500",
  bad: "ring-2 ring-destructive/50 border-destructive",
}

interface LiveChatReplyRatingControlsProps {
  disabled?: boolean
  saving?: boolean
  onSubmit: (rating: SupportReplyDraftRating, note: string) => void | Promise<void>
  className?: string
}

export function LiveChatReplyRatingControls({
  disabled = false,
  saving = false,
  onSubmit,
  className,
}: LiveChatReplyRatingControlsProps) {
  const [selected, setSelected] = useState<SupportReplyDraftRating | null>(null)
  const [note, setNote] = useState("")

  async function save() {
    if (!selected || saving || disabled) return
    await onSubmit(selected, note.trim())
  }

  return (
    <div className={cn("w-full max-w-[85%] space-y-1.5 px-1", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">Rate reply</span>
        {SUPPORT_REPLY_DRAFT_RATINGS.map((rating) => (
          <button
            key={rating}
            type="button"
            disabled={disabled || saving}
            onClick={() => setSelected(rating)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
              RATING_BUTTON_CLASS[rating],
              selected === rating && RATING_SELECTED_CLASS[rating],
            )}
          >
            {supportReplyExampleRatingLabel(rating)}
          </button>
        ))}
      </div>
      {selected ? (
        <div className="space-y-1.5 rounded-xl border border-border/60 bg-background/80 p-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={1000}
            disabled={disabled || saving}
            placeholder={
              selected === "very_good"
                ? "Optional: what made this reply good?"
                : "Why this rating? (helps the model learn)"
            }
            className="min-h-[56px] resize-none border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              {selected === "bad"
                ? "Bad + note teaches what to avoid."
                : "Saved to reply examples with your note."}
            </p>
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-full px-3 text-[11px]"
              disabled={disabled || saving}
              onClick={() => void save()}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : "Save rating"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
