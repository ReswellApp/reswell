import { NextResponse } from "next/server"
import {
  getGoogleMerchantAccountId,
  getGoogleMerchantAuthMode,
  getGoogleMerchantDataSourceName,
  getGoogleMerchantDeveloperEmail,
  getGoogleMerchantWorkloadIdentityAudience,
  isGoogleMerchantConfigured,
  isGoogleMerchantWorkloadIdentityConfigured,
} from "@/lib/google-merchant/config"
import { getGoogleMerchantDeveloperRegistration } from "@/lib/services/googleMerchantSetup"

/**
 * Debug: whether Merchant API env is present (never returns secrets).
 * GET /api/integrations/google-merchant/status
 */
export async function GET() {
  const configured = isGoogleMerchantConfigured()
  const accountId = getGoogleMerchantAccountId()
  const dataSourceName = getGoogleMerchantDataSourceName()
  const developerEmail = getGoogleMerchantDeveloperEmail()
  const authMode = getGoogleMerchantAuthMode()

  let registration: { ok: boolean; status?: number; error?: string } = {
    ok: false,
  }

  if (accountId && authMode !== "none") {
    try {
      const reg = await getGoogleMerchantDeveloperRegistration()
      registration = reg.ok
        ? { ok: true }
        : { ok: false, status: reg.status, error: reg.error }
    } catch (e) {
      registration = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  return NextResponse.json({
    google_merchant_configured: configured,
    auth_mode: authMode,
    workload_identity_audience: getGoogleMerchantWorkloadIdentityAudience(),
    account_id_set: Boolean(accountId),
    data_source_name_set: Boolean(dataSourceName),
    workload_identity_federation_configured: isGoogleMerchantWorkloadIdentityConfigured(),
    gcp_project_number_set: Boolean(process.env.GCP_PROJECT_NUMBER?.trim()),
    gcp_service_account_email_set: Boolean(process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim()),
    gcp_workload_identity_pool_id_set: Boolean(process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim()),
    gcp_workload_identity_pool_provider_id_set: Boolean(
      process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim(),
    ),
    service_account_json_set: Boolean(process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON?.trim()),
    google_application_credentials_set: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()),
    developer_email_set: Boolean(developerEmail),
    developer_registration: registration,
  })
}
