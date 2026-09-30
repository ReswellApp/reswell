import {
  dispositionForRecoveryKind,
  planUnusedLabelVoid,
  POSTAGE_AUDIT_LOOKBACK_DAYS,
  UNUSED_LABEL_APPROACHING_DAYS,
  type PostageDisposition,
  type PostageRecoveryKind,
} from "./unused-label-void-policy.ts"

export type PostageRecoveryLabel = {
  labelId: string
  createdAt: string
  trackingNumber: string | null
  carrierCode: string | null
  carrierId: string | null
  serviceCode: string | null
  voided: boolean
  isReturnLabel: boolean
  postageUsd: number
  insuranceUsd: number
  orderId: string | null
  adminVoidRequested: boolean
  attemptCount: number
}

export type PostageAuditRow = {
  labelId: string
  trackingNumber: string | null
  carrierCode: string | null
  carrierId: string | null
  serviceCode: string | null
  orderId: string | null
  isReturnLabel: boolean
  createdAt: string
  ageDays: number
  deadlineDays: number
  pastDeadline: boolean
  postageUsd: number
  insuranceUsd: number
  faceUsd: number
  disposition: PostageDisposition
  recoveryKind: PostageRecoveryKind
  scanStatusCode: string | null
  voidApproved: boolean | null
  shipengineVoided: boolean
  message: string | null
  adminVoidRequested: boolean
  attemptCount: number
  voidedThisRun: boolean
}

export type PostageRecoverySummary = {
  /** Always zero. This job voids postage; it does not refund buyers. */
  buyerRefundsIssued: 0
  listedCount: number
  recoveredBalanceUsd: number
  recoveredBalanceCount: number
  recoveredUpsUsd: number
  recoveredUpsCount: number
  recoveredUnknownBillingUsd: number
  recoveredUnknownBillingCount: number
  voidedThisRunUsd: number
  voidedThisRunCount: number
  approachingUsd: number
  approachingCount: number
  inGraceUsd: number
  inGraceCount: number
  expiredLostUsd: number
  expiredLostCount: number
  voidDeniedUsd: number
  voidDeniedCount: number
  scanUnconfirmedUsd: number
  scanUnconfirmedCount: number
  refundPendingUsd: number
  refundPendingCount: number
  voidSkippedUsd: number
  voidSkippedCount: number
  readyToVoidUsd: number
  readyToVoidCount: number
  scannedKeptUsd: number
  scannedKeptCount: number
  /** Postage that is unused, denied, unconfirmed, pending, or already past the void deadline. */
  cracksUsd: number
  cracksCount: number
}

export type PostageRecoveryRun = {
  buyerRefundsIssued: 0
  truncated: boolean
  autoVoidEnabled: boolean
  lookbackDays: number
  summary: PostageRecoverySummary
  cracks: PostageAuditRow[]
  recoveredThisRun: PostageAuditRow[]
  readyToVoid: PostageAuditRow[]
  rows: PostageAuditRow[]
}

export type PostageRecoveryDeps = {
  trackLabel: (
    labelId: string,
  ) => Promise<{ scanned: boolean; statusCode: string | null } | null>
  readLabel: (
    labelId: string,
  ) => Promise<{ voided: boolean; carrierId: string | null } | null>
  voidLabel: (
    labelId: string,
  ) => Promise<{ ok: true; approved: boolean; message: string } | { ok: false; error: string }>
}

const CRACK_DISPOSITIONS = new Set<PostageDisposition>([
  "expired_unrecoverable",
  "void_denied",
  "scan_unconfirmed",
  "refund_pending",
  "void_skipped",
])

const CRACK_LIMIT = 200
const RECOVERED_LIMIT = 80

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function faceUsd(postageUsd: number, insuranceUsd: number): number {
  return roundMoney(postageUsd + insuranceUsd)
}

function emptySummary(listedCount: number): PostageRecoverySummary {
  return {
    buyerRefundsIssued: 0,
    listedCount,
    recoveredBalanceUsd: 0,
    recoveredBalanceCount: 0,
    recoveredUpsUsd: 0,
    recoveredUpsCount: 0,
    recoveredUnknownBillingUsd: 0,
    recoveredUnknownBillingCount: 0,
    voidedThisRunUsd: 0,
    voidedThisRunCount: 0,
    approachingUsd: 0,
    approachingCount: 0,
    inGraceUsd: 0,
    inGraceCount: 0,
    expiredLostUsd: 0,
    expiredLostCount: 0,
    voidDeniedUsd: 0,
    voidDeniedCount: 0,
    scanUnconfirmedUsd: 0,
    scanUnconfirmedCount: 0,
    refundPendingUsd: 0,
    refundPendingCount: 0,
    voidSkippedUsd: 0,
    voidSkippedCount: 0,
    readyToVoidUsd: 0,
    readyToVoidCount: 0,
    scannedKeptUsd: 0,
    scannedKeptCount: 0,
    cracksUsd: 0,
    cracksCount: 0,
  }
}

export function summarizePostageAudit(rows: PostageAuditRow[]): PostageRecoverySummary {
  const summary = emptySummary(rows.length)
  for (const row of rows) {
    const amount = row.faceUsd
    switch (row.disposition) {
      case "voided_balance":
        summary.recoveredBalanceUsd += amount
        summary.recoveredBalanceCount += 1
        break
      case "voided_ups_account":
        summary.recoveredUpsUsd += amount
        summary.recoveredUpsCount += 1
        break
      case "voided_unconfirmed_billing":
        summary.recoveredUnknownBillingUsd += amount
        summary.recoveredUnknownBillingCount += 1
        break
      case "approaching":
        summary.approachingUsd += amount
        summary.approachingCount += 1
        break
      case "in_grace":
        summary.inGraceUsd += amount
        summary.inGraceCount += 1
        break
      case "expired_unrecoverable":
        summary.expiredLostUsd += amount
        summary.expiredLostCount += 1
        break
      case "void_denied":
        summary.voidDeniedUsd += amount
        summary.voidDeniedCount += 1
        break
      case "scan_unconfirmed":
        summary.scanUnconfirmedUsd += amount
        summary.scanUnconfirmedCount += 1
        break
      case "refund_pending":
        summary.refundPendingUsd += amount
        summary.refundPendingCount += 1
        break
      case "void_skipped":
        summary.voidSkippedUsd += amount
        summary.voidSkippedCount += 1
        break
      case "ready_to_void":
        summary.readyToVoidUsd += amount
        summary.readyToVoidCount += 1
        break
      case "scanned_keep":
        summary.scannedKeptUsd += amount
        summary.scannedKeptCount += 1
        break
      default:
        break
    }
    if (row.voidedThisRun) {
      summary.voidedThisRunUsd += amount
      summary.voidedThisRunCount += 1
    }
    if (CRACK_DISPOSITIONS.has(row.disposition)) {
      summary.cracksUsd += amount
      summary.cracksCount += 1
    }
  }

  for (const key of Object.keys(summary) as Array<keyof PostageRecoverySummary>) {
    if (key === "buyerRefundsIssued") continue
    if (key.endsWith("Usd")) {
      summary[key] = roundMoney(summary[key] as number) as never
    }
  }
  summary.buyerRefundsIssued = 0
  return summary
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index]!)
    }
  })
  await Promise.all(workers)
  return results
}

function baseRow(
  label: PostageRecoveryLabel,
  plan: {
    ageDays: number
    deadlineDays: number
    pastDeadline: boolean
    recoveryKind: PostageRecoveryKind
    disposition: PostageDisposition
  },
  extras: Partial<PostageAuditRow>,
): PostageAuditRow {
  return {
    labelId: label.labelId,
    trackingNumber: label.trackingNumber,
    carrierCode: label.carrierCode,
    carrierId: label.carrierId,
    serviceCode: label.serviceCode,
    orderId: label.orderId,
    isReturnLabel: label.isReturnLabel,
    createdAt: label.createdAt,
    ageDays: Math.round(plan.ageDays * 10) / 10,
    deadlineDays: plan.deadlineDays,
    pastDeadline: plan.pastDeadline,
    postageUsd: roundMoney(label.postageUsd),
    insuranceUsd: roundMoney(label.insuranceUsd),
    faceUsd: faceUsd(label.postageUsd, label.insuranceUsd),
    disposition: plan.disposition,
    recoveryKind: plan.recoveryKind,
    scanStatusCode: null,
    voidApproved: label.voided ? true : null,
    shipengineVoided: label.voided,
    message: null,
    adminVoidRequested: label.adminVoidRequested,
    attemptCount: label.attemptCount,
    voidedThisRun: false,
    ...extras,
  }
}

/**
 * Classify every label in the lookback window and void the ones that qualify.
 * Callers must not issue buyer refunds from this result.
 */
export async function executePostageRecovery(params: {
  labels: PostageRecoveryLabel[]
  now: Date
  autoVoidEnabled: boolean
  /** Classify voids without calling ShipEngine void. */
  dryRun?: boolean
  reswellUpsCarrierId: string
  truncated: boolean
  deps: PostageRecoveryDeps
}): Promise<PostageRecoveryRun> {
  const rows = await mapPool(params.labels, 5, async (label) => {
    let carrierId = label.carrierId
    const code = (label.carrierCode ?? "").toLowerCase()
    if (!carrierId && code.includes("ups")) {
      const facts = await params.deps.readLabel(label.labelId)
      if (facts?.carrierId) carrierId = facts.carrierId
    }
    const resolved: PostageRecoveryLabel = { ...label, carrierId }

    const createdMs = Date.parse(resolved.createdAt)
    const ageDays = Number.isFinite(createdMs)
      ? (params.now.getTime() - createdMs) / 86_400_000
      : 0
    const needsTracking =
      !resolved.voided &&
      (resolved.adminVoidRequested || ageDays >= UNUSED_LABEL_APPROACHING_DAYS || !Number.isFinite(createdMs))

    let scanned: boolean | null = null
    let statusCode: string | null = null
    if (needsTracking) {
      const tracked = await params.deps.trackLabel(resolved.labelId)
      if (tracked) {
        scanned = tracked.scanned
        statusCode = tracked.statusCode
      }
    }

    const plan = planUnusedLabelVoid({
      now: params.now,
      createdAtIso: resolved.createdAt,
      voided: resolved.voided,
      carrierCode: resolved.carrierCode,
      carrierId: resolved.carrierId,
      scanned: resolved.voided ? false : needsTracking ? scanned : null,
      adminVoidRequested: resolved.adminVoidRequested,
      autoVoidEnabled: params.autoVoidEnabled,
      reswellUpsCarrierId: params.reswellUpsCarrierId,
    })

    if (plan.action !== "void") {
      return baseRow(resolved, plan, { scanStatusCode: statusCode })
    }

    if (params.dryRun) {
      return baseRow(resolved, { ...plan, disposition: "ready_to_void" }, {
        scanStatusCode: statusCode,
        voidApproved: null,
        shipengineVoided: false,
        message: "Unused. Recovery will void this label.",
      })
    }

    const attemptCount = resolved.attemptCount + 1
    let voidResult: { ok: true; approved: boolean; message: string } | { ok: false; error: string }
    try {
      voidResult = await params.deps.voidLabel(resolved.labelId)
    } catch (error) {
      voidResult = { ok: false, error: error instanceof Error ? error.message : "Void failed" }
    }

    if (!voidResult.ok || !voidResult.approved) {
      const message = voidResult.ok ? voidResult.message : voidResult.error
      return baseRow(resolved, { ...plan, disposition: "void_denied" }, {
        scanStatusCode: statusCode,
        voidApproved: false,
        shipengineVoided: false,
        message,
        attemptCount,
      })
    }

    const confirmed = await params.deps.readLabel(resolved.labelId)
    if (confirmed?.voided) {
      return baseRow(resolved, {
        ...plan,
        disposition: dispositionForRecoveryKind(plan.recoveryKind),
      }, {
        scanStatusCode: statusCode,
        voidApproved: true,
        shipengineVoided: true,
        message: voidResult.message,
        attemptCount,
        voidedThisRun: true,
        carrierId: confirmed.carrierId ?? resolved.carrierId,
      })
    }

    return baseRow(resolved, { ...plan, disposition: "refund_pending" }, {
      scanStatusCode: statusCode,
      voidApproved: true,
      shipengineVoided: false,
      message: confirmed
        ? "Carrier approved the void, but ShipEngine has not marked the label voided yet."
        : "Carrier approved the void, but the label could not be re-read to confirm it.",
      attemptCount,
    })
  })

  const summary = summarizePostageAudit(rows)
  const cracks = rows
    .filter((row) => CRACK_DISPOSITIONS.has(row.disposition))
    .sort((a, b) => b.faceUsd - a.faceUsd)
    .slice(0, CRACK_LIMIT)
  const recoveredThisRun = rows
    .filter((row) => row.voidedThisRun)
    .sort((a, b) => b.faceUsd - a.faceUsd)
    .slice(0, RECOVERED_LIMIT)
  const readyToVoid = rows
    .filter((row) => row.disposition === "ready_to_void")
    .sort((a, b) => b.faceUsd - a.faceUsd)
    .slice(0, RECOVERED_LIMIT)

  return {
    buyerRefundsIssued: 0,
    truncated: params.truncated,
    autoVoidEnabled: params.autoVoidEnabled,
    lookbackDays: POSTAGE_AUDIT_LOOKBACK_DAYS,
    summary,
    cracks,
    recoveredThisRun,
    readyToVoid,
    rows,
  }
}
