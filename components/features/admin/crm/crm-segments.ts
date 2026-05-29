import { CalendarClock, Flame, LayoutGrid, Sparkles, Trophy, type LucideIcon } from "lucide-react"
import type { CrmContactPriority, CrmContactSource, CrmContactStatus } from "@/lib/db/crm"

export type CrmFilterState = {
  status: CrmContactStatus | "all"
  priority: CrmContactPriority | "all"
  source: CrmContactSource | "all"
  assignedTo: string | "all" | "unassigned"
  tagId: string | null
  followUpOnly: boolean
  createdWithinDays: number | null
}

export const CRM_DEFAULT_FILTERS: CrmFilterState = {
  status: "all",
  priority: "all",
  source: "all",
  assignedTo: "all",
  tagId: null,
  followUpOnly: false,
  createdWithinDays: null,
}

export type CrmSegment = {
  id: string
  label: string
  icon: LucideIcon
  filters: CrmFilterState
}

export const CRM_SEGMENTS: CrmSegment[] = [
  {
    id: "all",
    label: "All contacts",
    icon: LayoutGrid,
    filters: { ...CRM_DEFAULT_FILTERS },
  },
  {
    id: "hot",
    label: "Hot leads",
    icon: Flame,
    filters: { ...CRM_DEFAULT_FILTERS, priority: "high" },
  },
  {
    id: "overdue",
    label: "Follow-up due",
    icon: CalendarClock,
    filters: { ...CRM_DEFAULT_FILTERS, followUpOnly: true },
  },
  {
    id: "new",
    label: "New this week",
    icon: Sparkles,
    filters: { ...CRM_DEFAULT_FILTERS, createdWithinDays: 7 },
  },
  {
    id: "customers",
    label: "Customers",
    icon: Trophy,
    filters: { ...CRM_DEFAULT_FILTERS, status: "customer" },
  },
]

export function filtersMatchSegment(filters: CrmFilterState, segment: CrmSegment): boolean {
  return (
    filters.status === segment.filters.status &&
    filters.priority === segment.filters.priority &&
    filters.source === segment.filters.source &&
    filters.assignedTo === segment.filters.assignedTo &&
    filters.tagId === segment.filters.tagId &&
    filters.followUpOnly === segment.filters.followUpOnly &&
    filters.createdWithinDays === segment.filters.createdWithinDays
  )
}

export function activeSegmentId(filters: CrmFilterState): string | null {
  const match = CRM_SEGMENTS.find((segment) => filtersMatchSegment(filters, segment))
  return match?.id ?? null
}
