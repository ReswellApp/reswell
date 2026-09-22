import type { PnlEntryRow, PnlStatus } from "@/lib/db/pnl"
import type { UpdatePnlEntryInput } from "@/lib/validations/pnl"

export interface PnlSheetDraft {
  purchase_price: string
  purchase_date: string
  bought_from: string
  asking_price: string
  sale_price: string
  status: PnlStatus
}

function moneyText(value: number | null | undefined): string {
  if (value == null || value === 0) return ""
  return String(value)
}

export function draftFromEntry(entry: PnlEntryRow): PnlSheetDraft {
  return {
    purchase_price: moneyText(entry.purchase_price),
    purchase_date: entry.purchase_date ?? "",
    bought_from: entry.bought_from ?? "",
    asking_price: moneyText(entry.asking_price),
    sale_price: moneyText(entry.sale_price),
    status: entry.status,
  }
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "")
  if (cleaned === "") return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null
}

function moneyEqual(raw: string, stored: number | null | undefined): boolean {
  const parsed = parseMoney(raw)
  const current = stored == null || stored === 0 ? null : stored
  return parsed === current
}

export function draftIsDirty(draft: PnlSheetDraft, entry: PnlEntryRow): boolean {
  return (
    !moneyEqual(draft.purchase_price, entry.purchase_price) ||
    draft.purchase_date !== (entry.purchase_date ?? "") ||
    draft.bought_from.trim() !== (entry.bought_from ?? "").trim() ||
    !moneyEqual(draft.asking_price, entry.asking_price) ||
    !moneyEqual(draft.sale_price, entry.sale_price) ||
    draft.status !== entry.status
  )
}

export function draftToUpdatePayload(
  draft: PnlSheetDraft,
  entry: PnlEntryRow,
): UpdatePnlEntryInput | null {
  if (!draftIsDirty(draft, entry)) return null
  const salePrice = parseMoney(draft.sale_price)
  const status = draft.status === "sold" || salePrice != null ? "sold" : draft.status
  return {
    id: entry.id,
    purchasePrice: parseMoney(draft.purchase_price) ?? 0,
    purchaseDate: draft.purchase_date || "",
    boughtFrom: draft.bought_from.trim(),
    askingPrice: parseMoney(draft.asking_price),
    salePrice,
    status,
  }
}
