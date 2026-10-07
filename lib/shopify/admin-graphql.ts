import { shopifyGraphqlEndpoint } from "@/lib/shopify/config"

type GraphqlError = {
  message?: string
  extensions?: { code?: string }
}

type GraphqlResponse<T> = {
  data?: T
  errors?: GraphqlError[]
  extensions?: {
    cost?: {
      throttleStatus?: {
        currentlyAvailable?: number
        restoreRate?: number
      }
    }
  }
}

export class ShopifyGraphqlError extends Error {
  readonly status: number
  readonly retryable: boolean

  constructor(
    message: string,
    status: number,
    retryable: boolean,
  ) {
    super(message)
    this.name = "ShopifyGraphqlError"
    this.status = status
    this.retryable = retryable
  }
}

export async function shopifyGraphqlRequest<T>(input: {
  shopDomain: string
  accessToken: string
  query: string
  variables?: Record<string, unknown>
  signal?: AbortSignal
}): Promise<T> {
  const response = await fetch(shopifyGraphqlEndpoint(input.shopDomain), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": input.accessToken,
    },
    body: JSON.stringify({
      query: input.query,
      variables: input.variables ?? {},
    }),
    cache: "no-store",
    signal: input.signal,
  })

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500
    throw new ShopifyGraphqlError(
      `Shopify GraphQL request failed (${response.status})`,
      response.status,
      retryable,
    )
  }

  const body = (await response.json()) as GraphqlResponse<T>
  if (body.errors?.length) {
    const throttled = body.errors.some(
      (error) => error.extensions?.code === "THROTTLED",
    )
    const message =
      body.errors
        .map((error) => error.message?.trim())
        .filter(Boolean)
        .join("; ") || "Shopify GraphQL returned an error"
    throw new ShopifyGraphqlError(message, 200, throttled)
  }
  if (!body.data) {
    throw new ShopifyGraphqlError(
      "Shopify GraphQL response had no data",
      502,
      true,
    )
  }
  return body.data
}

export function throwOnShopifyUserErrors(
  errors: Array<{ field?: string[] | null; message?: string | null }> | null | undefined,
): void {
  if (!errors?.length) return
  const message = errors
    .map((error) => error.message?.trim())
    .filter(Boolean)
    .join("; ")
  throw new ShopifyGraphqlError(
    message || "Shopify rejected the operation",
    422,
    false,
  )
}
