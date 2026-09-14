"use client"

import { useState } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  deleteSupportReplyExampleAction,
  updateSupportReplyExampleAction,
} from "@/lib/actions/supportReplyExamples"
import type { SupportReplyExampleAdminView } from "@/lib/types/supportReplyDraft"
import { adminSupportCaseHref } from "@/lib/utils/support-case-paths"
import { SUPPORT_CASE_KIND_LABEL } from "@/lib/utils/support-case-display"
import type { SupportCaseKind } from "@/lib/types/supportCase"
import {
  SupportReplyExampleEditor,
  exampleToDraft,
  type SupportReplyExampleDraft,
} from "./support-reply-example-editor"
import { SupportReplyExamplePreview } from "./support-reply-example-preview"
import { SupportReplyExampleRating } from "./support-reply-example-rating"

function kindLabel(kind: string | null): string | null {
  if (!kind) return null
  return SUPPORT_CASE_KIND_LABEL[kind as SupportCaseKind] ?? kind
}

interface SupportReplyExampleCardProps {
  example: SupportReplyExampleAdminView
  onChanged: () => void
}

export function SupportReplyExampleCard({ example, onChanged }: SupportReplyExampleCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SupportReplyExampleDraft>(() => exampleToDraft(example))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const created = new Date(example.createdAt)
  const kind = kindLabel(example.kind)

  async function save() {
    setSaving(true)
    const result = await updateSupportReplyExampleAction({
      id: example.id,
      customer_excerpt: draft.customer_excerpt,
      staff_reply: draft.staff_reply,
      rating: draft.rating,
      kind: draft.kind,
      cited_help_slugs: draft.cited_help_slugs,
    })
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    toast.success("Example updated")
    setEditing(false)
    onChanged()
  }

  async function remove() {
    setDeleting(true)
    const result = await deleteSupportReplyExampleAction({ id: example.id })
    setDeleting(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    toast.success("Example deleted")
    onChanged()
  }

  return (
    <article className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SupportReplyExampleRating rating={example.rating} />
        {kind ? <span className="text-xs text-muted-foreground">{kind}</span> : null}
        <span className="text-xs text-muted-foreground" title={format(created, "PPpp")}>
          {formatDistanceToNow(created, { addSuffix: true })}
        </span>
        {example.caseId ? (
          <Link
            href={adminSupportCaseHref(example.caseId)}
            className="text-xs font-medium underline-offset-4 hover:underline"
          >
            Open case
          </Link>
        ) : null}
      </div>

      {editing ? (
        <SupportReplyExampleEditor
          exampleId={example.id}
          draft={draft}
          saving={saving}
          onChange={setDraft}
          onCancel={() => {
            setDraft(exampleToDraft(example))
            setEditing(false)
          }}
          onSave={() => void save()}
        />
      ) : (
        <>
          <SupportReplyExamplePreview example={example} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(exampleToDraft(example))
                setEditing(true)
              }}
            >
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" size="sm" variant="outline" disabled={deleting}>
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this example?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Later drafts will stop learning from this reply. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void remove()}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </article>
  )
}
