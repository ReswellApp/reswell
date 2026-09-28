import type { DeliveryStatus } from "@/lib/types/adsManager"

export function googleChannelLabel(raw: string | undefined): string {
  switch (raw) {
    case "SEARCH":
      return "Search"
    case "PERFORMANCE_MAX":
      return "Performance Max"
    case "SHOPPING":
      return "Shopping"
    case "DISPLAY":
      return "Display"
    case "VIDEO":
      return "Video"
    case "DEMAND_GEN":
      return "Demand Gen"
    case "MULTI_CHANNEL":
      return "App"
    default:
      return humanizeEnum(raw) || "Campaign"
  }
}

export function metaObjectiveLabel(raw: string | undefined): string {
  switch (raw) {
    case "OUTCOME_TRAFFIC":
      return "Traffic"
    case "OUTCOME_SALES":
      return "Sales"
    case "OUTCOME_AWARENESS":
      return "Awareness"
    case "OUTCOME_ENGAGEMENT":
      return "Engagement"
    case "OUTCOME_LEADS":
      return "Leads"
    case "OUTCOME_APP_PROMOTION":
      return "App"
    default:
      return humanizeEnum(raw) || "Campaign"
  }
}

export function googleDeliveryNote(primary: string | undefined, status: DeliveryStatus): string | null {
  if (!primary) return null
  if (primary === "ELIGIBLE" || primary === "PAUSED" || primary === "REMOVED" || primary === "ENABLED") {
    return null
  }
  if (status === "paused") return null
  return humanizeEnum(primary)
}

export function metaDeliveryNote(effective: string | undefined, status: DeliveryStatus): string | null {
  if (!effective) return null
  if (effective === "ACTIVE" && status === "enabled") return null
  if (effective === "PAUSED" && status === "paused") return null
  return humanizeEnum(effective)
}

export function humanizeEnum(raw: string | undefined): string | null {
  if (!raw) return null
  const text = raw.replaceAll("_", " ").toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function mapDeliveryStatus(raw: string | undefined): DeliveryStatus {
  switch (raw) {
    case "ENABLED":
    case "ACTIVE":
      return "enabled"
    case "PAUSED":
      return "paused"
    case "REMOVED":
    case "DELETED":
    case "ARCHIVED":
      return "removed"
    default:
      return "other"
  }
}

export function toGoogleStatus(status: "enabled" | "paused"): "ENABLED" | "PAUSED" {
  return status === "enabled" ? "ENABLED" : "PAUSED"
}

export function toMetaStatus(status: "enabled" | "paused"): "ACTIVE" | "PAUSED" {
  return status === "enabled" ? "ACTIVE" : "PAUSED"
}
