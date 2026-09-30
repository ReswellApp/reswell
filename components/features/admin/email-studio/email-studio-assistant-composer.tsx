"use client"

import { useRef } from "react"
import { ArrowUp, Check, Command, ImagePlus, LayoutTemplate, MessageSquareText, X } from "lucide-react"
import { ASSISTANT_SCREENSHOT_MAX_COUNT } from "@/lib/email-studio/assistant-images"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { PreparedAssistantScreenshot } from "@/components/features/admin/email-studio/prepare-assistant-screenshot"

export interface AssistantScreenshotAttachment extends PreparedAssistantScreenshot {
  id: string
}

export function EmailStudioAssistantComposer({
  scope,
  enabled,
  pending,
  preparing,
  locked,
  text,
  attachments,
  onTextChange,
  onSend,
  onAttachFiles,
  onRemoveAttachment,
}: {
  scope: "email" | "flow"
  enabled: boolean
  pending: boolean
  preparing: boolean
  locked: boolean
  text: string
  attachments: AssistantScreenshotAttachment[]
  onTextChange: (value: string) => void
  onSend: () => void
  onAttachFiles: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const canSend = enabled && !pending && !preparing && !locked && (text.trim().length > 0 || attachments.length > 0)
  const disabled = !enabled || pending || preparing || locked

  return (
    <footer className="border-t border-border bg-background p-3">
      {locked ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#5574AD]/5 px-2.5 py-2 text-[11px] text-[#355185]">
          <Check className="h-3.5 w-3.5" />
          Review the preview before starting another request.
        </div>
      ) : null}
      <div className="rounded-2xl border border-border bg-background p-2 shadow-sm transition focus-within:border-[#5574AD]/50 focus-within:ring-2 focus-within:ring-[#5574AD]/10">
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-1 pb-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="relative">
                {/* Blob previews cannot go through next/image. */}
                <img
                  src={attachment.previewUrl}
                  alt="Attached screenshot"
                  className="h-14 w-14 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove screenshot"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm"
                  onClick={() => onRemoveAttachment(attachment.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <Textarea
          value={text}
          aria-label="Message the assistant"
          placeholder={
            enabled
              ? scope === "email"
                ? "Describe a layout, or drop a screenshot…"
                : "Describe a flow, or drop a screenshot…"
              : "Assistant is off until the AI gateway key is set"
          }
          maxLength={4000}
          disabled={disabled}
          className="min-h-20 resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onChange={(event) => onTextChange(event.target.value)}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files)
            if (files.length === 0) return
            event.preventDefault()
            onAttachFiles(files)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              if (canSend) onSend()
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Command className="h-3 w-3" />
            Enter to send · Shift + Enter for a new line
          </span>
          <div className="flex items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                event.target.value = ""
                if (files.length > 0) onAttachFiles(files)
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl"
              aria-label="Attach a screenshot"
              disabled={disabled || attachments.length >= ASSISTANT_SCREENSHOT_MAX_COUNT}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              className="h-8 w-8 rounded-xl"
              aria-label="Send message"
              disabled={!canSend}
              onClick={onSend}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <ImagePlus className="h-3 w-3" />
          Drop a screenshot
        </span>
        <span className="flex items-center gap-1">
          <LayoutTemplate className="h-3 w-3" />
          Canvas-aware
        </span>
        <span className="flex items-center gap-1">
          <MessageSquareText className="h-3 w-3" />
          Approval required
        </span>
      </div>
    </footer>
  )
}
