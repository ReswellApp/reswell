import {
  maxBoardWidthInchesFromInput,
  totalBoardLengthInchesFromCombinedInput,
} from "./board-measurements.ts"

/** Inclusive board-length / width gates that pick a packed carton for a dropoff location. */
export type DropoffBoxRule = {
  id: string
  label: string
  /** Inclusive lower bound in inches. `null` = no floor. */
  minLengthIn: number | null
  /** Inclusive upper bound in inches. */
  maxLengthIn: number
  /** Inclusive max board width in inches. `null` = no width cap. */
  maxWidthIn: number | null
  boxLengthIn: number
  boxWidthIn: number
  boxHeightIn: number
  weightLb: number
}

export type DropoffBoxMatch = {
  rule: DropoffBoxRule
  boardLengthIn: number
  boardWidthIn: number | null
}

export type BoardDimsForDropoff = {
  boardLength?: string | null
  boardWidthInches?: string | null
}

export function parseDropoffBoxRules(raw: unknown): DropoffBoxRule[] {
  if (!Array.isArray(raw)) return []
  const out: DropoffBoxRule[] = []
  for (const row of raw) {
    const parsed = parseDropoffBoxRule(row)
    if (parsed) out.push(parsed)
  }
  return out
}

export function parseDropoffBoxRule(raw: unknown): DropoffBoxRule | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === "string" ? r.id.trim() : ""
  const label = typeof r.label === "string" ? r.label.trim() : ""
  const maxLengthIn = num(r.maxLengthIn)
  const boxLengthIn = num(r.boxLengthIn)
  const boxWidthIn = num(r.boxWidthIn)
  const boxHeightIn = num(r.boxHeightIn)
  const weightLb = num(r.weightLb)
  if (!id || !label) return null
  if (maxLengthIn == null || maxLengthIn <= 0) return null
  if (boxLengthIn == null || boxLengthIn <= 0) return null
  if (boxWidthIn == null || boxWidthIn <= 0) return null
  if (boxHeightIn == null || boxHeightIn <= 0) return null
  if (weightLb == null || weightLb <= 0) return null
  const minLengthIn = r.minLengthIn == null || r.minLengthIn === "" ? null : num(r.minLengthIn)
  if (r.minLengthIn != null && r.minLengthIn !== "" && minLengthIn == null) return null
  const maxWidthIn = r.maxWidthIn == null || r.maxWidthIn === "" ? null : num(r.maxWidthIn)
  if (r.maxWidthIn != null && r.maxWidthIn !== "" && maxWidthIn == null) return null
  return {
    id,
    label,
    minLengthIn,
    maxLengthIn,
    maxWidthIn,
    boxLengthIn,
    boxWidthIn,
    boxHeightIn,
    weightLb,
  }
}

export function matchDropoffBoxRule(
  rules: DropoffBoxRule[],
  dims: BoardDimsForDropoff,
): DropoffBoxMatch | null {
  const boardLengthIn = totalBoardLengthInchesFromCombinedInput(dims.boardLength ?? "")
  if (boardLengthIn == null || boardLengthIn <= 0) return null
  const widthRaw = dims.boardWidthInches?.trim() ?? ""
  const boardWidthIn = widthRaw ? maxBoardWidthInchesFromInput(widthRaw) : null

  for (const rule of rules) {
    if (rule.minLengthIn != null && boardLengthIn < rule.minLengthIn) continue
    if (boardLengthIn > rule.maxLengthIn) continue
    if (rule.maxWidthIn != null) {
      if (boardWidthIn == null || boardWidthIn > rule.maxWidthIn) continue
    }
    return { rule, boardLengthIn, boardWidthIn }
  }
  return null
}

export function dropoffRuleToPackageForm(rule: DropoffBoxRule): {
  reswellPackageLengthIn: string
  reswellPackageWidthIn: string
  reswellPackageHeightIn: string
  reswellPackageWeightLb: string
  reswellPackageWeightOz: string
} {
  return {
    reswellPackageLengthIn: formatInches(rule.boxLengthIn),
    reswellPackageWidthIn: formatInches(rule.boxWidthIn),
    reswellPackageHeightIn: formatInches(rule.boxHeightIn),
    reswellPackageWeightLb: formatInches(rule.weightLb),
    reswellPackageWeightOz: "0",
  }
}

export function formatDropoffBoxSize(rule: Pick<DropoffBoxRule, "boxLengthIn" | "boxWidthIn" | "boxHeightIn">): string {
  return `${formatInches(rule.boxLengthIn)}\u00d7${formatInches(rule.boxWidthIn)}\u00d7${formatInches(rule.boxHeightIn)}`
}

export function formatDropoffPackedParcel(row: {
  shipping_packed_length_in?: number | string | null
  shipping_packed_width_in?: number | string | null
  shipping_packed_height_in?: number | string | null
}): string {
  const L = num(row.shipping_packed_length_in)
  const W = num(row.shipping_packed_width_in)
  const H = num(row.shipping_packed_height_in)
  if (L == null || W == null || H == null) return "—"
  return `${formatInches(L)}\u00d7${formatInches(W)}\u00d7${formatInches(H)}`
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number.parseFloat(value.replace(/,/g, ""))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function formatInches(n: number): string {
  if (!Number.isFinite(n)) return ""
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}
