import type {
  ContactMessageSource,
  ContactMessageSupportStatus,
} from "@/lib/db/contactMessages"

export const STATUS_LABEL: Record<ContactMessageSupportStatus, string> = {
  new: "New",
  triaged: "Triaged",
  ticket_created: "In progress",
  resolved: "Resolved",
}

/** Inbox workflow order — also drives the stage funnel left → right. */
export const STATUS_LIST: ContactMessageSupportStatus[] = [
  "new",
  "triaged",
  "ticket_created",
  "resolved",
]

export const STATUS_ORDER: Record<ContactMessageSupportStatus, number> = {
  new: 0,
  triaged: 1,
  ticket_created: 2,
  resolved: 3,
}

/** Solid Tailwind background used for funnel bars and accent dots. */
export const STATUS_BAR_CLASS: Record<ContactMessageSupportStatus, string> = {
  new: "bg-sky-500",
  triaged: "bg-violet-500",
  ticket_created: "bg-amber-500",
  resolved: "bg-emerald-500",
}

export const CHANNEL_LABEL: Record<ContactMessageSource, string> = {
  contact_form: "Website",
  messages_support: "Messages",
}

export const CHANNEL_COLOR: Record<ContactMessageSource, string> = {
  contact_form: "#6366f1",
  messages_support: "#0d9488",
}

export function statusBadgeVariant(
  s: ContactMessageSupportStatus,
): "default" | "secondary" | "outline" {
  switch (s) {
    case "new":
      return "outline"
    case "triaged":
      return "secondary"
    case "ticket_created":
      return "default"
    case "resolved":
      return "outline"
    default:
      return "secondary"
  }
}

export function channelBadgeVariant(s: ContactMessageSource): "default" | "secondary" | "outline" {
  return s === "messages_support" ? "default" : "secondary"
}
