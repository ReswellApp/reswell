/**
 * Unused ShipEngine postage recovery.
 *
 * A label that has not been physically scanned for 20 days is voided so the
 * carrier can credit the ShipEngine balance (or, for Reswell's own UPS account,
 * drop it from the UPS invoice). This never refunds the buyer.
 *
 * Carrier void windows (ShipEngine): USPS / Stamps.com 28 days, other carriers 30.
 * https://www.shipengine.com/docs/labels/voiding/
 */

export const UNUSED_LABEL_AUTO_VOID_AFTER_DAYS = 20
export const UNUSED_LABEL_APPROACHING_DAYS = 16
export const USPS_VOID_DEADLINE_DAYS = 28
export const DEFAULT_VOID_DEADLINE_DAYS = 30
export const POSTAGE_AUDIT_LOOKBACK_DAYS = 45

const MS_PER_DAY = 86_400_000

export type PostageRecoveryKind = "balance" | "ups_account" | "unknown_billing" | "none"

export type PostageDisposition =
  | "in_grace"
  | "approaching"
  | "scanned_keep"
  | "voided_balance"
  | "voided_ups_account"
  | "voided_unconfirmed_billing"
  | "void_denied"
  | "expired_unrecoverable"
  | "scan_unconfirmed"
  | "refund_pending"
  | "void_skipped"
  | "ready_to_void"

export type UnusedLabelPlan = {
  action: "none" | "void"
  disposition: PostageDisposition
  recoveryKind: PostageRecoveryKind
  ageDays: number
  deadlineDays: number
  pastDeadline: boolean
}

export function voidDeadlineDays(carrierCode: string | null | undefined): number {
  const code = (carrierCode ?? "").trim().toLowerCase()
  if (
    code.includes("usps") ||
    code.includes("stamps") ||
    code.includes("endicia") ||
    code.includes("postal")
  ) {
    return USPS_VOID_DEADLINE_DAYS
  }
  return DEFAULT_VOID_DEADLINE_DAYS
}

export function labelAgeDays(createdAt: Date, now: Date): number {
  return (now.getTime() - createdAt.getTime()) / MS_PER_DAY
}

export function postageRecoveryKind(params: {
  carrierCode: string | null
  carrierId: string | null
  reswellUpsCarrierId: string
}): PostageRecoveryKind {
  const carrierId = params.carrierId?.trim() || null
  if (carrierId && carrierId === params.reswellUpsCarrierId.trim()) return "ups_account"
  const code = (params.carrierCode ?? "").toLowerCase()
  if (code.includes("ups") && !carrierId) return "unknown_billing"
  return "balance"
}

export function dispositionForRecoveryKind(kind: PostageRecoveryKind): PostageDisposition {
  if (kind === "ups_account") return "voided_ups_account"
  if (kind === "unknown_billing") return "voided_unconfirmed_billing"
  return "voided_balance"
}

/**
 * Decide whether a label may be voided.
 * `scanned === null` means tracking could not be read — never void in that case.
 */
export function planUnusedLabelVoid(input: {
  now: Date
  createdAtIso: string
  voided: boolean
  carrierCode: string | null
  carrierId: string | null
  scanned: boolean | null
  adminVoidRequested: boolean
  autoVoidEnabled: boolean
  reswellUpsCarrierId: string
}): UnusedLabelPlan {
  const createdAt = Date.parse(input.createdAtIso)
  const deadlineDays = voidDeadlineDays(input.carrierCode)
  const recoveryKind = postageRecoveryKind({
    carrierCode: input.carrierCode,
    carrierId: input.carrierId,
    reswellUpsCarrierId: input.reswellUpsCarrierId,
  })

  if (!Number.isFinite(createdAt)) {
    return {
      action: "none",
      disposition: "scan_unconfirmed",
      recoveryKind: "none",
      ageDays: 0,
      deadlineDays,
      pastDeadline: false,
    }
  }

  const ageDays = labelAgeDays(new Date(createdAt), input.now)
  const pastDeadline = ageDays >= deadlineDays
  const base = { ageDays, deadlineDays, pastDeadline, recoveryKind }

  if (input.voided) {
    return {
      ...base,
      action: "none",
      disposition: dispositionForRecoveryKind(recoveryKind),
    }
  }

  if (input.scanned === true) {
    return { ...base, action: "none", disposition: "scanned_keep", recoveryKind: "none" }
  }

  const unusedAndInWindow =
    input.scanned === false && !pastDeadline && (input.adminVoidRequested || ageDays >= UNUSED_LABEL_AUTO_VOID_AFTER_DAYS)

  if (unusedAndInWindow && input.autoVoidEnabled) {
    return { ...base, action: "void", disposition: dispositionForRecoveryKind(recoveryKind) }
  }
  if (unusedAndInWindow && !input.autoVoidEnabled) {
    return { ...base, action: "none", disposition: "void_skipped" }
  }

  const needsScan =
    input.scanned == null &&
    (pastDeadline || input.adminVoidRequested || ageDays >= UNUSED_LABEL_APPROACHING_DAYS)
  if (needsScan) {
    return { ...base, action: "none", disposition: "scan_unconfirmed", recoveryKind: "none" }
  }

  if (pastDeadline && input.scanned === false) {
    return { ...base, action: "none", disposition: "expired_unrecoverable" }
  }

  if (ageDays >= UNUSED_LABEL_APPROACHING_DAYS && input.scanned === false) {
    return { ...base, action: "none", disposition: "approaching", recoveryKind: "none" }
  }

  return { ...base, action: "none", disposition: "in_grace", recoveryKind: "none" }
}
