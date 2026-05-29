import {
  CheckCircle2,
  Clock,
  Inbox,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import type {
  ContactMessageSource,
  ContactMessageSupportStatus,
} from "@/lib/db/contactMessages"

export type ContactMessagesFilterState = {
  status: ContactMessageSupportStatus | "all"
  channel: ContactMessageSource | "all"
  createdWithinDays: number | null
}

export const CONTACT_MESSAGES_DEFAULT_FILTERS: ContactMessagesFilterState = {
  status: "all",
  channel: "all",
  createdWithinDays: null,
}

export type ContactMessagesSegment = {
  id: string
  label: string
  icon: LucideIcon
  filters: ContactMessagesFilterState
}

export const CONTACT_MESSAGES_SEGMENTS: ContactMessagesSegment[] = [
  {
    id: "all",
    label: "All",
    icon: Inbox,
    filters: { ...CONTACT_MESSAGES_DEFAULT_FILTERS },
  },
  {
    id: "awaiting",
    label: "Awaiting reply",
    icon: Clock,
    filters: { ...CONTACT_MESSAGES_DEFAULT_FILTERS, status: "new" },
  },
  {
    id: "in-progress",
    label: "In progress",
    icon: MessageCircle,
    filters: { ...CONTACT_MESSAGES_DEFAULT_FILTERS, status: "ticket_created" },
  },
  {
    id: "resolved",
    label: "Resolved",
    icon: CheckCircle2,
    filters: { ...CONTACT_MESSAGES_DEFAULT_FILTERS, status: "resolved" },
  },
  {
    id: "new-week",
    label: "New this week",
    icon: Sparkles,
    filters: { ...CONTACT_MESSAGES_DEFAULT_FILTERS, createdWithinDays: 7 },
  },
]

export function filtersMatchSegment(
  filters: ContactMessagesFilterState,
  segment: ContactMessagesSegment,
): boolean {
  return (
    filters.status === segment.filters.status &&
    filters.channel === segment.filters.channel &&
    filters.createdWithinDays === segment.filters.createdWithinDays
  )
}

export function activeSegmentId(filters: ContactMessagesFilterState): string | null {
  return CONTACT_MESSAGES_SEGMENTS.find((s) => filtersMatchSegment(filters, s))?.id ?? null
}
