"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SUPPORT_CASE_KIND_LABEL } from "@/lib/utils/support-case-display"
import type { SupportReplyExampleAdminView } from "@/lib/types/supportReplyDraft"
import { supportReplyExampleRatingLabel } from "./support-reply-example-rating"
import {
  SUPPORT_REPLY_DRAFT_RATINGS,
  SUPPORT_REPLY_EXAMPLE_KINDS,
  type SupportReplyDraftRating,
  type SupportReplyExampleKind,
} from "@/lib/validations/supportReplyDraft"

const SELECT_CLASS = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm"

export type SupportReplyExampleDraft = {
  customer_excerpt: string
  staff_reply: string
  rating: SupportReplyDraftRating
  kind: SupportReplyExampleKind | ""
  cited_help_slugs: string
}

export function exampleToDraft(example: SupportReplyExampleAdminView): SupportReplyExampleDraft {
  return {
    customer_excerpt: example.customerExcerpt,
    staff_reply: example.staffReply,
    rating: example.rating,
    kind: SUPPORT_REPLY_EXAMPLE_KINDS.includes(example.kind as SupportReplyExampleKind)
      ? (example.kind as SupportReplyExampleKind)
      : "",
    cited_help_slugs: example.citedHelpSlugs.join("\n"),
  }
}

interface SupportReplyExampleEditorProps {
  exampleId: string
  draft: SupportReplyExampleDraft
  saving: boolean
  onChange: (draft: SupportReplyExampleDraft) => void
  onCancel: () => void
  onSave: () => void
}

export function SupportReplyExampleEditor({
  exampleId,
  draft,
  saving,
  onChange,
  onCancel,
  onSave,
}: SupportReplyExampleEditorProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`example-rating-${exampleId}`}>Rating</Label>
          <select
            id={`example-rating-${exampleId}`}
            className={SELECT_CLASS}
            value={draft.rating}
            onChange={(event) =>
              onChange({ ...draft, rating: event.target.value as SupportReplyDraftRating })
            }
          >
            {SUPPORT_REPLY_DRAFT_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {supportReplyExampleRatingLabel(rating)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`example-kind-${exampleId}`}>Kind</Label>
          <select
            id={`example-kind-${exampleId}`}
            className={SELECT_CLASS}
            value={draft.kind}
            onChange={(event) =>
              onChange({ ...draft, kind: event.target.value as SupportReplyExampleKind | "" })
            }
          >
            <option value="">No kind</option>
            {SUPPORT_REPLY_EXAMPLE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {SUPPORT_CASE_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`example-customer-${exampleId}`}>Customer excerpt</Label>
        <Textarea
          id={`example-customer-${exampleId}`}
          value={draft.customer_excerpt}
          onChange={(event) => onChange({ ...draft, customer_excerpt: event.target.value })}
          className="min-h-[96px] resize-y"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`example-staff-${exampleId}`}>Staff reply the model will imitate</Label>
        <Textarea
          id={`example-staff-${exampleId}`}
          value={draft.staff_reply}
          onChange={(event) => onChange({ ...draft, staff_reply: event.target.value })}
          className="min-h-[140px] resize-y"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`example-slugs-${exampleId}`}>Cited help slugs</Label>
        <Textarea
          id={`example-slugs-${exampleId}`}
          value={draft.cited_help_slugs}
          onChange={(event) => onChange({ ...draft, cited_help_slugs: event.target.value })}
          className="min-h-[72px] resize-y"
          placeholder="One slug per line"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
