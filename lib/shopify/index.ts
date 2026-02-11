import {
  ProductSortKey,
  ShopifyProduct,
} from './types'

import { parseShopifyDomain } from './parse-shopify-domain'
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT_KEY } from './constants'

/**
 * Multi-tenant Shopify Storefront API client.
 * Each seller provides their own Shopify domain; we use the
 * tokenless Storefront API (public read-only access) to pull products.
 */
function getStorefrontUrl(rawDomain: string): string {
  const domain = parseShopifyDomain(rawDomain)
  return `https://${domain}/api/2025-07/graphql.json`
}

async function shopifyFetch<T>({
  storeDomain,
  query,
  variables = {},
}: {
  storeDomain: string
  query: string
  variables?: Record<string, unknown>
}): Promise<{ data: T; errors?: unknown[] }> {
  const url = getStorefrontUrl(storeDomain)

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 }, // cache 5 min
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Shopify API error for ${storeDomain}: ${response.status} - ${errorBody}`,
    )
  }

  const json = await response.json()
  if (json.errors) {
    console.error(`Shopify GraphQL errors (${storeDomain}):`, json.errors)
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`)
  }

  return json
}

const PRODUCT_FRAGMENT = /* gql */ `
  fragment ProductFields on Product {
    id
    title
    description
    descriptionHtml
    handle
    availableForSale
    productType
    options {
      id
      name
      values
    }
    images(first: 5) {
      edges {
        node {
          url
          altText
        }
      }
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    compareAtPriceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    variants(first: 10) {
      edges {
        node {
          id
          title
          price {
            amount
            currencyCode
          }
          availableForSale
          selectedOptions {
            name
            value
          }
        }
      }
    }
  }
`

export async function getShopifyProducts({
  storeDomain,
  first = DEFAULT_PAGE_SIZE,
  sortKey = DEFAULT_SORT_KEY,
  reverse = false,
  searchQuery,
}: {
  storeDomain: string
  first?: number
  sortKey?: ProductSortKey
  reverse?: boolean
  searchQuery?: string
}): Promise<ShopifyProduct[]> {
  const query = /* gql */ `
    ${PRODUCT_FRAGMENT}
    query getProducts($first: Int!, $sortKey: ProductSortKeys!, $reverse: Boolean, $query: String) {
      products(first: $first, sortKey: $sortKey, reverse: $reverse, query: $query) {
        edges {
          node {
            ...ProductFields
          }
        }
      }
    }
  `

  const { data } = await shopifyFetch<{
    products: { edges: Array<{ node: ShopifyProduct }> }
  }>({
    storeDomain,
    query,
    variables: { first, sortKey, reverse, query: searchQuery },
  })

  return data.products.edges.map((edge) => edge.node)
}

export async function getShopifyProduct({
  storeDomain,
  handle,
}: {
  storeDomain: string
  handle: string
}): Promise<ShopifyProduct | null> {
  const query = /* gql */ `
    ${PRODUCT_FRAGMENT}
    query getProduct($handle: String!) {
      product(handle: $handle) {
        ...ProductFields
      }
    }
  `

  const { data } = await shopifyFetch<{
    product: ShopifyProduct | null
  }>({
    storeDomain,
    query,
    variables: { handle },
  })

  return data.product
}

/**
 * Validate a Shopify domain by attempting to fetch a single product.
 * Returns true if the store is reachable and has the Storefront API enabled.
 */
export async function validateShopifyDomain(rawDomain: string): Promise<boolean> {
  try {
    const url = getStorefrontUrl(rawDomain)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ shop { name } }`,
      }),
    })
    if (!response.ok) return false
    const json = await response.json()
    return !json.errors && !!json.data?.shop?.name
  } catch {
    return false
  }
}
