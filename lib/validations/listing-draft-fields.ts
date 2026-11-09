import { z } from "zod"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Draft saves accept a numeric price or a formatted string (`$1,200`). */
export const draftOptionalMoney = z.preprocess((value) => {
  if (value == null) return undefined
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string") return value
  return undefined
}, z.string().optional())

/** Empty, null, or a non-uuid becomes null so a draft is not rejected. */
export const draftOptionalUuid = z.preprocess((value) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed || !UUID_RE.test(trimmed)) return null
  return trimmed
}, z.string().uuid().nullable())

/** Blank listing id starts a new draft. A real uuid updates that draft. */
export const draftOptionalListingId = z.preprocess((value) => {
  if (value == null) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}, z.string().uuid().nullable())

/**
 * Purchase date from `<input type="date">`, a date column, or an ISO timestamp.
 * Anything else is stored as unset instead of failing the whole draft.
 */
export const draftOptionalDate = z.preprocess((value) => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  const day = trimmed.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : ""
}, z.string())

/** Null coordinates from a cleared map pin are omitted, not a 400. */
export const draftOptionalCoord = z.preprocess((value) => {
  if (value == null || value === "") return undefined
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value === "string" && value.trim()) {
    const amount = Number(value)
    return Number.isFinite(amount) ? amount : undefined
  }
  return undefined
}, z.number().optional())
