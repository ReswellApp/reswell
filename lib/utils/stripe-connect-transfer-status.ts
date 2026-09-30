export type BankTransferBadgeKind = "processing" | "sent" | "reversed" | "failed" | "raw"

export interface BankTransferBadge {
  kind: BankTransferBadgeKind
  /** Visible badge label. */
  label: string
  /** Short deposit timing, already formatted. */
  hint: string | null
}

/** Stripe `arrival_date` is UTC midnight. Format the calendar day, not the viewer's previous evening. */
export function formatStripeArrivalDay(iso: string | null | undefined): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms))
}

function arrivalHint(
  bankPayoutStatus: string | null | undefined,
  expectedArrivalAt: string | null | undefined,
): string | null {
  const day = formatStripeArrivalDay(expectedArrivalAt)
  if (!day) return null
  if (bankPayoutStatus === "paid") return `Deposit ${day}`
  if (bankPayoutStatus === "pending" || bankPayoutStatus === "in_transit") return `Arrives ${day}`
  return null
}

/**
 * What Earnings should show for one bank cash-out.
 * Transfer `SUCCEEDED` only means funds reached the connected Stripe balance.
 * `bankPayoutStatus === "paid"` is Stripe's expected deposit date.
 */
export function bankTransferBadge(input: {
  status: string
  payoutSpeed?: string | null
  bankPayoutStatus?: string | null
  expectedArrivalAt?: string | null
}): BankTransferBadge {
  const transferStatus = input.status.toUpperCase()
  if (transferStatus === "REVERSED" || transferStatus === "FAILED") {
    return { kind: "reversed", label: "Reversed", hint: null }
  }

  const bankStatus = input.bankPayoutStatus?.toLowerCase() ?? null
  if (bankStatus === "failed" || bankStatus === "canceled") {
    return { kind: "failed", label: "Failed", hint: "Stripe will retry" }
  }

  const hint = arrivalHint(bankStatus, input.expectedArrivalAt)
  if (bankStatus === "paid") {
    return { kind: "sent", label: "Sent", hint }
  }
  if (bankStatus === "pending" || bankStatus === "in_transit") {
    return { kind: "processing", label: "Processing", hint }
  }

  if (transferStatus === "SUCCEEDED") {
    const instant = input.payoutSpeed?.toLowerCase() === "instant"
    if (instant) return { kind: "sent", label: "Sent", hint: null }
    return { kind: "processing", label: "Processing", hint: null }
  }

  return { kind: "raw", label: input.status, hint: null }
}
