export type FinalizeMarketplaceOrderClientResult =
  | { ok: true; orderId: string; alreadyProcessed?: boolean }
  | { ok: false; error: string; unauthorized?: boolean }

const FINALIZE_RETRYABLE_STATUSES = new Set([503, 502, 504])
const FINALIZE_MAX_ATTEMPTS = 10
const FINALIZE_BASE_DELAY_MS = 400

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Calls POST /api/stripe/finalize-order with short retries when the server is waiting
 * on a concurrent webhook/order commit (503).
 */
export async function finalizeMarketplaceOrderClient(
  paymentIntentId: string,
): Promise<FinalizeMarketplaceOrderClientResult> {
  const piId = paymentIntentId.trim()
  if (!piId) {
    return { ok: false, error: "Missing payment" }
  }

  let lastError = "Could not complete order"

  for (let attempt = 0; attempt < FINALIZE_MAX_ATTEMPTS; attempt += 1) {
    const res = await fetch("/api/stripe/finalize-order", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_intent_id: piId }),
    })

    const data = (await res.json()) as {
      error?: string
      orderId?: string
      alreadyProcessed?: boolean
    }

    if (res.status === 401) {
      return { ok: false, error: "Unauthorized", unauthorized: true }
    }

    if (res.ok) {
      const orderId = data.orderId?.trim()
      if (!orderId) {
        return { ok: false, error: "Could not complete order" }
      }
      return {
        ok: true,
        orderId,
        ...(data.alreadyProcessed ? { alreadyProcessed: true } : {}),
      }
    }

    lastError =
      typeof data.error === "string" && data.error.trim() ? data.error.trim() : lastError

    if (FINALIZE_RETRYABLE_STATUSES.has(res.status) && attempt < FINALIZE_MAX_ATTEMPTS - 1) {
      await sleepMs(FINALIZE_BASE_DELAY_MS * (attempt + 1))
      continue
    }

    return { ok: false, error: lastError }
  }

  return { ok: false, error: lastError }
}
