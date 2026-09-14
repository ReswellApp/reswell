"use client"

import { useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import type { SupportMacroRecord } from "@/lib/db/supportMacros"
import {
  applySupportMacroVars,
  SUPPORT_MACRO_VAR_HINTS,
} from "@/lib/utils/apply-support-macro-vars"
import { SUPPORT_CASE_KIND_LABEL } from "@/lib/utils/support-case-display"
import { SUPPORT_MACRO_KIND_FILTERS } from "@/lib/validations/supportMacros"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const ALL_KINDS = "all"
const PREVIEW_VARS = {
  name: "Alex",
  order_ref: "RS-1042",
  tracking: "1Z999AA10123456784",
  order_status: "shipped",
}

interface SupportMacroEditorProps {
  macro: SupportMacroRecord | null
  pending: boolean
  onSave: (input: {
    title: string
    body: string
    kind_filter: string | null
    is_active: boolean
    sort_order: number
  }) => void
  onDelete?: () => void
  onCancel: () => void
}

export function SupportMacroEditor({
  macro,
  pending,
  onSave,
  onDelete,
  onCancel,
}: SupportMacroEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [title, setTitle] = useState(macro?.title ?? "")
  const [body, setBody] = useState(macro?.body ?? "")
  const [kindFilter, setKindFilter] = useState(macro?.kind_filter ?? ALL_KINDS)
  const [isActive, setIsActive] = useState(macro?.is_active ?? true)
  const [sortOrder, setSortOrder] = useState(String(macro?.sort_order ?? 0))

  function insertToken(token: string) {
    const el = bodyRef.current
    if (!el) {
      setBody((current) => `${current}${token}`)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + token.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <form
      className="space-y-4 rounded-lg border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        const parsedSort = Number.parseInt(sortOrder, 10)
        onSave({
          title,
          body,
          kind_filter: kindFilter === ALL_KINDS ? null : kindFilter,
          is_active: isActive,
          sort_order: Number.isFinite(parsedSort) ? parsedSort : 0,
        })
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="macro-title">Title</Label>
        <Input
          id="macro-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Shipping delay"
          maxLength={120}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="macro-body">Body</Label>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {SUPPORT_MACRO_VAR_HINTS.map((hint) => (
            <Button
              key={hint.key}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-full px-2 text-xs"
              onClick={() => insertToken(hint.token)}
            >
              {hint.token}
            </Button>
          ))}
        </div>
        <Textarea
          ref={bodyRef}
          id="macro-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={8}
          maxLength={8000}
          required
          placeholder="Hi {{name}}, thanks for checking on {{order_ref}}…"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Show for</Label>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All kinds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_KINDS}>All ticket kinds</SelectItem>
              {SUPPORT_MACRO_KIND_FILTERS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {SUPPORT_CASE_KIND_LABEL[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="macro-sort">Sort order</Label>
          <Input
            id="macro-sort"
            type="number"
            min={0}
            max={9999}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label htmlFor="macro-active" className="text-sm">
          Active in the inbox picker
        </Label>
        <Switch id="macro-active" checked={isActive} onCheckedChange={setIsActive} />
      </div>
      {body.trim() ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Preview</p>
          <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-sm">
            {applySupportMacroVars(body, PREVIEW_VARS)}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !title.trim() || !body.trim()}>
          {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {macro ? "Save" : "Add macro"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        {macro && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="ml-auto text-destructive hover:text-destructive"
            disabled={pending}
            onClick={onDelete}
          >
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  )
}
