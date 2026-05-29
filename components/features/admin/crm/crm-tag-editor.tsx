"use client"

import { useMemo, useState } from "react"
import { Check, Loader2, Plus, Tag as TagIcon } from "lucide-react"
import type { CrmTagColor, CrmTagRow } from "@/lib/db/crm"
import {
  addCrmContactTagAction,
  createCrmTagAction,
  removeCrmContactTagAction,
} from "@/lib/actions/crmAdmin"
import {
  CRM_TAG_COLOR_OPTIONS,
  crmTagBadgeClass,
  crmTagDotClass,
} from "@/components/features/admin/crm/crm-labels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function CrmTagEditor({
  contactId,
  allTags,
  contactTags,
  onMutated,
  onTagsChanged,
}: {
  contactId: string
  allTags: CrmTagRow[]
  contactTags: CrmTagRow[]
  onMutated: () => void
  onTagsChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [newColor, setNewColor] = useState<CrmTagColor>("teal")
  const [busy, setBusy] = useState(false)

  const assignedIds = useMemo(() => new Set(contactTags.map((t) => t.id)), [contactTags])
  const trimmed = query.trim()
  const exactMatch = useMemo(
    () => allTags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase()),
    [allTags, trimmed],
  )

  async function toggleTag(tag: CrmTagRow) {
    setBusy(true)
    try {
      const isOn = assignedIds.has(tag.id)
      const result = isOn
        ? await removeCrmContactTagAction({ contactId, tagId: tag.id })
        : await addCrmContactTagAction({ contactId, tagId: tag.id })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      onMutated()
    } catch (err) {
      console.error("CrmTagEditor.toggleTag:", err)
      toast.error("Could not update tags")
    } finally {
      setBusy(false)
    }
  }

  async function createAndAssign() {
    if (!trimmed) return
    setBusy(true)
    try {
      const created = await createCrmTagAction({ name: trimmed, color: newColor })
      if ("error" in created) {
        toast.error(created.error)
        return
      }
      const linked = await addCrmContactTagAction({ contactId, tagId: created.tagId })
      if ("error" in linked) {
        toast.error(linked.error)
        return
      }
      toast.success(`Tag “${trimmed}” added`)
      setQuery("")
      onTagsChanged()
      onMutated()
    } catch (err) {
      console.error("CrmTagEditor.createAndAssign:", err)
      toast.error("Could not create tag")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {contactTags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          disabled={busy}
          onClick={() => void toggleTag(tag)}
          title="Remove tag"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-70",
            crmTagBadgeClass(tag.color),
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", crmTagDotClass(tag.color))} />
          {tag.name}
        </button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 rounded-full px-2 text-xs">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            <span className="ml-1">Tag</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command shouldFilter>
            <CommandInput placeholder="Search or create…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{trimmed ? "No matching tags" : "No tags yet"}</CommandEmpty>
              <CommandGroup>
                {allTags.map((tag) => (
                  <CommandItem key={tag.id} value={tag.name} onSelect={() => void toggleTag(tag)}>
                    <span className={cn("mr-2 h-2.5 w-2.5 rounded-full", crmTagDotClass(tag.color))} />
                    <span className="flex-1 truncate">{tag.name}</span>
                    {assignedIds.has(tag.id) ? <Check className="h-4 w-4" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {trimmed && !exactMatch ? (
            <div className="border-t p-2">
              <div className="mb-2 flex items-center gap-1">
                {CRM_TAG_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    onClick={() => setNewColor(color)}
                    className={cn(
                      "h-4 w-4 rounded-full ring-offset-2 transition-all",
                      crmTagDotClass(color),
                      newColor === color ? "ring-2 ring-foreground" : "",
                    )}
                  />
                ))}
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={() => void createAndAssign()}
              >
                <TagIcon className="mr-1.5 h-3.5 w-3.5" />
                Create “{trimmed}”
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function CrmTagChips({ tags, max = 3, className }: { tags: CrmTagRow[]; max?: number; className?: string }) {
  if (tags.length === 0) return null
  const shown = tags.slice(0, max)
  const overflow = tags.length - shown.length
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((tag) => (
        <span
          key={tag.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
            crmTagBadgeClass(tag.color),
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", crmTagDotClass(tag.color))} />
          {tag.name}
        </span>
      ))}
      {overflow > 0 ? (
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] leading-none">
          +{overflow}
        </Badge>
      ) : null}
    </div>
  )
}
