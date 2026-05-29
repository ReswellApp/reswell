"use client"

import { useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { CalendarClock, Flame, GripVertical } from "lucide-react"
import {
  crmContactDisplayName,
  type CrmContactStatus,
  type CrmContactWithProfile,
} from "@/lib/db/crm"
import {
  CRM_STATUS_LABEL,
  contactNeedsFollowUp,
  crmPriorityBadgeClass,
  CRM_PRIORITY_LABEL,
} from "@/components/features/admin/crm/crm-labels"
import { CrmTagChips } from "@/components/features/admin/crm/crm-tag-editor"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

const BOARD_STAGES: CrmContactStatus[] = ["lead", "prospect", "active", "customer", "inactive"]

const STAGE_ACCENT: Record<CrmContactStatus, string> = {
  lead: "bg-sky-500",
  prospect: "bg-violet-500",
  active: "bg-emerald-500",
  customer: "bg-teal-500",
  inactive: "bg-muted-foreground/40",
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function CardBody({ contact }: { contact: CrmContactWithProfile }) {
  const name = crmContactDisplayName(contact)
  const avatarUrl = contact.profile?.avatar_url
  const needsFollowUp = contactNeedsFollowUp(contact)
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2.5">
        <Avatar className="h-8 w-8">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {contact.email ?? contact.profile?.email ?? "No email"}
          </p>
        </div>
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      </div>
      {contact.tags.length > 0 ? <CrmTagChips tags={contact.tags} max={3} /> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            crmPriorityBadgeClass(contact.priority),
          )}
        >
          {contact.priority === "high" ? <Flame className="h-3 w-3" /> : null}
          {CRM_PRIORITY_LABEL[contact.priority]}
        </span>
        {needsFollowUp ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900 dark:text-amber-300">
            <CalendarClock className="h-3 w-3" />
            Due
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5">
          {contact.assignee ? (
            <Avatar className="h-5 w-5" title={contact.assignee.display_name ?? "Owner"}>
              {contact.assignee.avatar_url ? <AvatarImage src={contact.assignee.avatar_url} alt="" /> : null}
              <AvatarFallback className="text-[8px]">
                {initials(contact.assignee.display_name ?? "?")}
              </AvatarFallback>
            </Avatar>
          ) : null}
          <span className="text-[11px] text-muted-foreground">
            {contact.last_contacted_at
              ? formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })
              : "Never"}
          </span>
        </span>
      </div>
    </div>
  )
}

function BoardCard({
  contact,
  selected,
  onSelect,
  onToggleSelect,
}: {
  contact: CrmContactWithProfile
  selected: boolean
  onSelect: (id: string) => void
  onToggleSelect: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: contact.id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-40",
        selected && "ring-2 ring-teal-500",
      )}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(contact.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(contact.id)
        }
      }}
    >
      <div
        className={cn(
          "absolute right-2 top-2 z-10 transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(contact.id)}
          aria-label={`Select ${crmContactDisplayName(contact)}`}
          className="bg-background"
        />
      </div>
      <CardBody contact={contact} />
    </div>
  )
}

function BoardColumn({
  stage,
  contacts,
  selectedIds,
  onSelect,
  onToggleSelect,
}: {
  stage: CrmContactStatus
  contacts: CrmContactWithProfile[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onToggleSelect: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("h-2.5 w-2.5 rounded-full", STAGE_ACCENT[stage])} />
        <h3 className="text-sm font-semibold">{CRM_STATUS_LABEL[stage]}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {contacts.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-xl border border-dashed p-2 transition-colors",
          isOver ? "border-teal-400 bg-teal-50/50 dark:bg-teal-950/20" : "border-border bg-muted/20",
        )}
      >
        {contacts.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Drop contacts here</p>
        ) : (
          contacts.map((contact) => (
            <BoardCard
              key={contact.id}
              contact={contact}
              selected={selectedIds.has(contact.id)}
              onSelect={onSelect}
              onToggleSelect={onToggleSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function CrmBoardView({
  contacts,
  selectedIds,
  onMove,
  onSelect,
  onToggleSelect,
}: {
  contacts: CrmContactWithProfile[]
  selectedIds: Set<string>
  onMove: (contactIds: string[], status: CrmContactStatus) => void
  onSelect: (id: string) => void
  onToggleSelect: (id: string) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const grouped = useMemo(() => {
    const map: Record<CrmContactStatus, CrmContactWithProfile[]> = {
      lead: [],
      prospect: [],
      active: [],
      customer: [],
      inactive: [],
    }
    for (const contact of contacts) {
      if (contact.status in map) map[contact.status].push(contact)
    }
    return map
  }, [contacts])

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeId) ?? null,
    [contacts, activeId],
  )
  const draggingMultiple = activeId != null && selectedIds.has(activeId) && selectedIds.size > 1

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const draggedId = String(event.active.id)
    setActiveId(null)
    const { over } = event
    if (!over) return
    const nextStatus = String(over.id) as CrmContactStatus
    if (!BOARD_STAGES.includes(nextStatus)) return
    const ids =
      selectedIds.has(draggedId) && selectedIds.size > 1 ? Array.from(selectedIds) : [draggedId]
    const movable = ids.filter((id) => {
      const contact = contacts.find((c) => c.id === id)
      return contact && contact.status !== nextStatus
    })
    if (movable.length === 0) return
    onMove(movable, nextStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {BOARD_STAGES.map((stage) => (
          <BoardColumn
            key={stage}
            stage={stage}
            contacts={grouped[stage]}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeContact ? (
          <div className="relative w-72 rotate-2 rounded-lg border bg-card p-3 shadow-xl">
            {draggingMultiple ? (
              <span className="absolute -right-2 -top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-teal-600 px-1.5 text-xs font-semibold text-white shadow">
                {selectedIds.size}
              </span>
            ) : null}
            <CardBody contact={activeContact} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
