import { getVercelOidcToken } from "@vercel/oidc"
import { ExternalAccountClient, GoogleAuth } from "google-auth-library"
import {
  GOOGLE_MERCHANT_OAUTH_SCOPE,
  getGoogleMerchantAuthMode,
  isGoogleMerchantWorkloadIdentityConfigured,
} from "./config"

type AccessTokenClient = {
  getAccessToken(): Promise<{ token?: string | null }>
}

let authClientPromise: Promise<AccessTokenClient> | null = null

function parseServiceAccountJson(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error("GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON is not valid JSON")
  }
}

function createWorkloadIdentityClient(): AccessTokenClient {
  const projectNumber = process.env.GCP_PROJECT_NUMBER?.trim()
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim()
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim()
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim()

  if (!projectNumber || !serviceAccountEmail || !poolId || !providerId) {
    throw new Error(
      "Workload Identity Federation requires GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL, GCP_WORKLOAD_IDENTITY_POOL_ID, and GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
    )
  }

  const client = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    scopes: [GOOGLE_MERCHANT_OAUTH_SCOPE],
    subject_token_supplier: {
      getSubjectToken: async () => getVercelOidcToken(),
    },
  })

  if (!client) {
    throw new Error("Failed to create ExternalAccountClient for Workload Identity Federation")
  }

  return client
}

async function createAuthClient(): Promise<AccessTokenClient> {
  if (isGoogleMerchantWorkloadIdentityConfigured()) {
    return createWorkloadIdentityClient()
  }

  const credentials = parseServiceAccountJson()
  if (credentials) {
    const auth = new GoogleAuth({
      credentials,
      scopes: [GOOGLE_MERCHANT_OAUTH_SCOPE],
    })
    return auth.getClient()
  }

  const auth = new GoogleAuth({
    scopes: [GOOGLE_MERCHANT_OAUTH_SCOPE],
  })
  return auth.getClient()
}

async function getAuthClient(): Promise<AccessTokenClient> {
  if (!authClientPromise) {
    authClientPromise = createAuthClient()
  }
  return authClientPromise
}

export async function getGoogleMerchantAccessToken(): Promise<string> {
  const client = await getAuthClient()
  const token = await client.getAccessToken()
  if (!token.token) {
    throw new Error(
      `Failed to obtain Google Merchant API access token (auth mode: ${getGoogleMerchantAuthMode()})`,
    )
  }
  return token.token
}
