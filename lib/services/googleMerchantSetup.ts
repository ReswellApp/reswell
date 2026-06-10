import { googleMerchantRequest } from "@/lib/google-merchant/client"
import {
  getGoogleMerchantDataSourceName,
  getGoogleMerchantDeveloperEmail,
  getGoogleMerchantParentAccount,
  isGoogleMerchantConfigured,
  matchesGoogleMerchantFeedProduct,
} from "@/lib/google-merchant/config"
import type { GoogleMerchantProductInputPayload } from "@/lib/google-merchant/map-listing-to-product-input"
import { buildProductInputResourceName } from "@/lib/google-merchant/product-input-name"

export type GoogleMerchantSetupResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string; data?: unknown }

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const err = data as { error?: { message?: string }; message?: string }
    if (err.error?.message) return err.error.message
    if (err.message) return err.message
  }
  return fallback
}

/**
 * One-time: link your GCP project to Merchant Center.
 * Requires Merchant Center admin + service account invited as a user.
 *
 * @see https://developers.google.com/merchant/api/samples/register-gcp
 */
export async function registerGoogleMerchantGcp(
  developerEmail?: string,
): Promise<GoogleMerchantSetupResult> {
  const email = developerEmail?.trim() || getGoogleMerchantDeveloperEmail()
  if (!email) {
    return {
      ok: false,
      status: 400,
      error: "developerEmail required (body or GOOGLE_MERCHANT_DEVELOPER_EMAIL)",
    }
  }

  const parent = getGoogleMerchantParentAccount()
  const res = await googleMerchantRequest(
    `/accounts/v1/${parent}/developerRegistration:registerGcp`,
    {
      method: "POST",
      body: JSON.stringify({ developerEmail: email }),
    },
  )

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: errorMessage(res.data, "registerGcp failed"),
      data: res.data,
    }
  }

  return { ok: true, data: res.data }
}

/**
 * One-time: create a primary API data source for product uploads.
 * Save the returned `name` as GOOGLE_MERCHANT_DATA_SOURCE_NAME.
 */
export async function createGoogleMerchantPrimaryDataSource(
  displayName = "Reswell API Primary Feed",
): Promise<GoogleMerchantSetupResult> {
  const parent = getGoogleMerchantParentAccount()
  const res = await googleMerchantRequest(`/datasources/v1/${parent}/dataSources`, {
    method: "POST",
    body: JSON.stringify({
      displayName,
      primaryProductDataSource: {
        countries: ["US"],
      },
    }),
  })

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: errorMessage(res.data, "dataSources.create failed"),
      data: res.data,
    }
  }

  return { ok: true, data: res.data }
}

export async function insertGoogleMerchantProductInput(
  productInput: GoogleMerchantProductInputPayload,
): Promise<GoogleMerchantSetupResult> {
  if (!isGoogleMerchantConfigured()) {
    return { ok: false, status: 503, error: "Google Merchant API is not configured" }
  }

  const parent = getGoogleMerchantParentAccount()
  const dataSource = getGoogleMerchantDataSourceName()
  if (!dataSource) {
    return { ok: false, status: 503, error: "GOOGLE_MERCHANT_DATA_SOURCE_NAME is not set" }
  }

  const query = new URLSearchParams({ dataSource })
  const res = await googleMerchantRequest(
    `/products/v1/${parent}/productInputs:insert?${query.toString()}`,
    {
      method: "POST",
      body: JSON.stringify(productInput),
    },
  )

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: errorMessage(res.data, "productInputs.insert failed"),
      data: res.data,
    }
  }

  return { ok: true, data: res.data }
}

export async function deleteGoogleMerchantProductInput(
  offerId: string,
): Promise<GoogleMerchantSetupResult> {
  if (!isGoogleMerchantConfigured()) {
    return { ok: false, status: 503, error: "Google Merchant API is not configured" }
  }

  const dataSource = getGoogleMerchantDataSourceName()
  if (!dataSource) {
    return { ok: false, status: 503, error: "GOOGLE_MERCHANT_DATA_SOURCE_NAME is not set" }
  }

  const name = buildProductInputResourceName(offerId)
  const query = new URLSearchParams({ dataSource })
  const res = await googleMerchantRequest(`/products/v1/${name}?${query.toString()}`, {
    method: "DELETE",
  })

  if (!res.ok && res.status !== 404) {
    return {
      ok: false,
      status: res.status,
      error: errorMessage(res.data, "productInputs.delete failed"),
      data: res.data,
    }
  }

  return { ok: true, data: res.data ?? { deleted: true } }
}

export type GoogleMerchantListedProduct = {
  offerId: string
  contentLanguage: string
  feedLabel: string
}

type GoogleMerchantProductsListResponse = {
  products?: Array<{
    offerId?: string
    contentLanguage?: string
    feedLabel?: string
    dataSource?: string
  }>
  nextPageToken?: string
}

/**
 * Page through processed Merchant Center products for reconciliation deletes.
 */
export async function listGoogleMerchantProductsPage(options?: {
  pageToken?: string
  pageSize?: number
}): Promise<
  | { ok: true; products: GoogleMerchantListedProduct[]; nextPageToken?: string }
  | { ok: false; status: number; error: string }
> {
  if (!isGoogleMerchantConfigured()) {
    return { ok: false, status: 503, error: "Google Merchant API is not configured" }
  }

  const parent = getGoogleMerchantParentAccount()
  const pageSize = Math.min(Math.max(options?.pageSize ?? 250, 1), 1000)
  const params = new URLSearchParams({ pageSize: String(pageSize) })
  if (options?.pageToken?.trim()) {
    params.set("pageToken", options.pageToken.trim())
  }

  const res = await googleMerchantRequest(`/products/v1/${parent}/products?${params.toString()}`, {
    method: "GET",
  })

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: errorMessage(res.data, "products.list failed"),
    }
  }

  const data = res.data as GoogleMerchantProductsListResponse
  const products = (data.products ?? [])
    .map((product) => ({
      offerId: product.offerId?.trim() ?? "",
      contentLanguage: product.contentLanguage?.trim() ?? "",
      feedLabel: product.feedLabel?.trim() ?? "",
      dataSource: product.dataSource?.trim() ?? "",
    }))
    .filter((product) => matchesGoogleMerchantFeedProduct(product))

  return {
    ok: true,
    products,
    nextPageToken: data.nextPageToken?.trim() || undefined,
  }
}

export async function listAllGoogleMerchantProducts(): Promise<
  | { ok: true; products: GoogleMerchantListedProduct[] }
  | { ok: false; status: number; error: string }
> {
  const products: GoogleMerchantListedProduct[] = []
  let pageToken: string | undefined

  for (;;) {
    const page = await listGoogleMerchantProductsPage({ pageToken })
    if (!page.ok) return page

    products.push(...page.products)
    if (!page.nextPageToken) break
    pageToken = page.nextPageToken
  }

  return { ok: true, products }
}

export async function getGoogleMerchantDeveloperRegistration(): Promise<GoogleMerchantSetupResult> {
  const parent = getGoogleMerchantParentAccount()
  const res = await googleMerchantRequest(
    `/accounts/v1/${parent}/developerRegistration`,
    { method: "GET" },
  )

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: errorMessage(res.data, "developerRegistration.get failed"),
      data: res.data,
    }
  }

  return { ok: true, data: res.data }
}
