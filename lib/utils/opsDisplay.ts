import type { OpsGroupRow, OpsSignalRow } from "@/lib/types/ops"

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asStatusCode(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (/^\d{3}$/.test(trimmed)) return trimmed
  }
  return null
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
}

/** Prefer metadata, then signal payload, then title like `GET /path → 500`. */
export function opsGroupStatusCode(group: OpsGroupRow): string | null {
  const fromMeta = asStatusCode(group.metadata?.status_code)
  if (fromMeta) return fromMeta

  const titleMatch = group.title.match(/→\s*(\d{3})\b/)
  if (titleMatch?.[1]) return titleMatch[1]

  return null
}

export function opsGroupMethod(group: OpsGroupRow): string | null {
  const fromMeta = asNonEmptyString(group.metadata?.method)
  if (fromMeta) return fromMeta

  const titleMatch = group.title.match(/^([A-Z]+)\s+\//)
  return titleMatch?.[1] ?? null
}

export function opsGroupLevel(group: OpsGroupRow): string | null {
  return (
    asNonEmptyString(group.metadata?.level) ||
    asNonEmptyString(group.metadata?.raw_level)
  )
}

export function opsGroupSampleRequestIds(group: OpsGroupRow): string[] {
  return asStringList(group.metadata?.sample_request_ids)
}

export function opsSignalStatusCode(signal: OpsSignalRow): string | null {
  return asStatusCode(signal.payload?.status_code)
}

export function opsSignalMethod(signal: OpsSignalRow): string | null {
  return asNonEmptyString(signal.payload?.method)
}

export function opsSignalLevel(signal: OpsSignalRow): string | null {
  return (
    asNonEmptyString(signal.payload?.raw_level) ||
    asNonEmptyString(signal.payload?.level)
  )
}

export function opsSignalSampleRequestIds(signal: OpsSignalRow): string[] {
  return asStringList(signal.payload?.sample_request_ids)
}

export function opsSignalOccurrenceCount(signal: OpsSignalRow): number | null {
  const value = signal.payload?.occurrence_count
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value
  return null
}

export function hasOpsSignalDetails(signal: OpsSignalRow): boolean {
  return (
    opsSignalStatusCode(signal) != null ||
    opsSignalMethod(signal) != null ||
    opsSignalLevel(signal) != null ||
    opsSignalSampleRequestIds(signal).length > 0 ||
    Object.keys(signal.payload ?? {}).length > 0
  )
}
