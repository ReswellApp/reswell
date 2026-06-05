/**
 * PayPal webhook signature verification using the Notifications REST API.
 *
 * Calls POST /v1/notifications/verify-webhook-signature to validate that the
 * incoming request was actually sent by PayPal and not forged.
 *
 * Requires env vars: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_MODE.
 */

export class PayPalWebhookVerificationError extends Error {
  constructor(
    message: string,
    public readonly code: "missing_headers" | "missing_config" | "verification_failed" | "network_error",
  ) {
    super(message)
    this.name = "PayPalWebhookVerificationError"
  }
}

interface PayPalWebhookHeaders {
  transmissionId: string
  transmissionTime: string
  transmissionSig: string
  certUrl: string
  authAlgo: string
}

function extractWebhookHeaders(headers: Headers): PayPalWebhookHeaders | null {
  const transmissionId = headers.get("paypal-transmission-id")
  const transmissionTime = headers.get("paypal-transmission-time")
  const transmissionSig = headers.get("paypal-transmission-sig")
  const certUrl = headers.get("paypal-cert-url")
  const authAlgo = headers.get("paypal-auth-algo")

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return null
  }

  return { transmissionId, transmissionTime, transmissionSig, certUrl, authAlgo }
}

async function getPayPalAccessToken(apiBase: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new PayPalWebhookVerificationError(
      `PayPal token request failed: ${res.status}`,
      "network_error",
    )
  }

  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new PayPalWebhookVerificationError(
      "PayPal token response missing access_token",
      "network_error",
    )
  }

  return data.access_token
}

/**
 * Verify an incoming PayPal webhook request using their verify-webhook-signature API.
 * Throws PayPalWebhookVerificationError on failure.
 */
export async function verifyPayPalWebhookSignature(
  headers: Headers,
  rawBody: string,
): Promise<void> {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim()
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim()

  if (!clientId || !clientSecret) {
    throw new PayPalWebhookVerificationError(
      "PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured",
      "missing_config",
    )
  }

  if (!webhookId) {
    throw new PayPalWebhookVerificationError(
      "PAYPAL_WEBHOOK_ID not configured",
      "missing_config",
    )
  }

  const whHeaders = extractWebhookHeaders(headers)
  if (!whHeaders) {
    throw new PayPalWebhookVerificationError(
      "Missing required PayPal webhook headers",
      "missing_headers",
    )
  }

  const live = process.env.PAYPAL_MODE?.trim() === "live"
  const apiBase = live ? "https://api.paypal.com" : "https://api.sandbox.paypal.com"

  const accessToken = await getPayPalAccessToken(apiBase, clientId, clientSecret)

  let webhookEvent: unknown
  try {
    webhookEvent = JSON.parse(rawBody)
  } catch {
    throw new PayPalWebhookVerificationError(
      "Webhook body is not valid JSON",
      "verification_failed",
    )
  }

  const verifyBody = {
    auth_algo: whHeaders.authAlgo,
    cert_url: whHeaders.certUrl,
    transmission_id: whHeaders.transmissionId,
    transmission_sig: whHeaders.transmissionSig,
    transmission_time: whHeaders.transmissionTime,
    webhook_id: webhookId,
    webhook_event: webhookEvent,
  }

  const verifyRes = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(verifyBody),
    signal: AbortSignal.timeout(15_000),
  })

  if (!verifyRes.ok) {
    throw new PayPalWebhookVerificationError(
      `PayPal verify endpoint returned ${verifyRes.status}`,
      "network_error",
    )
  }

  const result = (await verifyRes.json()) as { verification_status?: string }

  if (result.verification_status !== "SUCCESS") {
    throw new PayPalWebhookVerificationError(
      `PayPal signature verification failed: ${result.verification_status ?? "unknown"}`,
      "verification_failed",
    )
  }
}
