"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateSupportReplyRootPromptAction } from "@/lib/actions/supportReplyExamples"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { SupportReplyRootPromptView } from "@/lib/types/supportReplyDraft"
import { SUPPORT_REPLY_ROOT_PROMPT_MAX } from "@/lib/validations/supportReplyDraft"

interface SupportReplyRootPromptEditorProps {
  initial: SupportReplyRootPromptView
}

export function SupportReplyRootPromptEditor({ initial }: SupportReplyRootPromptEditorProps) {
  const [body, setBody] = useState(initial.body)
  const [saved, setSaved] = useState(initial.body)
  const [saving, setSaving] = useState(false)
  const dirty = body !== saved

  async function save() {
    setSaving(true)
    const result = await updateSupportReplyRootPromptAction({ body })
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setSaved(result.data.body)
    setBody(result.data.body)
    toast.success("Root prompt saved")
  }

  return (
    <section className="rounded-lg border bg-card px-4 py-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Root prompt</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          First source of truth for how the agent acts, writes, and stays kind. Every draft
          follows this guide before examples, macros, or a conversation prompt.
        </p>
      </div>
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={SUPPORT_REPLY_ROOT_PROMPT_MAX}
        rows={12}
        className="min-h-[220px] resize-y font-mono text-[13px] leading-relaxed"
        aria-label="Root prompt for support reply drafts"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Save prompt
        </Button>
        {dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
      </div>
    </section>
  )
}