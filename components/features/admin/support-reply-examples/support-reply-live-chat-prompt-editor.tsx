"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateSupportReplyLiveChatPromptAction } from "@/lib/actions/supportReplyExamples"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { SupportReplyRootPromptView } from "@/lib/types/supportReplyDraft"
import { SUPPORT_REPLY_ROOT_PROMPT_MAX } from "@/lib/validations/supportReplyDraft"

interface SupportReplyLiveChatPromptEditorProps {
  initial: SupportReplyRootPromptView
}

export function SupportReplyLiveChatPromptEditor({
  initial,
}: SupportReplyLiveChatPromptEditorProps) {
  const [body, setBody] = useState(initial.body)
  const [saved, setSaved] = useState(initial.body)
  const [saving, setSaving] = useState(false)
  const dirty = body !== saved

  async function save() {
    setSaving(true)
    const result = await updateSupportReplyLiveChatPromptAction({ body })
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setSaved(result.data.body)
    setBody(result.data.body)
    toast.success("Live chat prompt saved")
  }

  return (
    <section className="rounded-lg border bg-card px-4 py-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Live chat response prompt</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Primary guide for live chat auto-replies: resolve the ask, confirm auth before order
          facts, never leak another customer&apos;s data, use /help + Purchase Protection + seller
          resources. Staff ratings in the widget teach later replies.
        </p>
      </div>
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={SUPPORT_REPLY_ROOT_PROMPT_MAX}
        rows={10}
        className="min-h-[180px] resize-y font-mono text-[13px] leading-relaxed"
        aria-label="Live chat response prompt"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Save live chat prompt
        </Button>
        {dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
      </div>
    </section>
  )
}
