import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchListingsDeskProfile,
  saveShopShippingDefaults,
} from "@/lib/db/shopCategoryPackageSizes"
import { shopifyGraphqlRequest } from "@/lib/shopify/admin-graphql"
import {
  EMPTY_SHOP_SHIPPING_DEFAULTS,
  SHOP_STORE_DEFAULT_ID,
  SHOP_STORE_DEFAULT_PACKAGE_NAME,
  lengthToInches,
  readShopShippingDefaults,
  weightToLb,
  type ShopSavedPackedSize,
  type ShopShippingDefaults,
} from "@/lib/shop-shipping-defaults"
import {
  shopifyDefaultPackageResponseSchema,
  shopifyShippingPackageSchema,
  type ShopifyShippingPackage,
} from "@/lib/validations/shopify-default-package"

const PACKAGE_FIELDS = `
  name
  default
  dimensions { length width height unit }
  weight { value unit }
`

/** Shop default package only. Rates, zones, and buyer contact stay on Shopify. */
export const SHOPIFY_DEFAULT_PACKAGE_ROOT_QUERY = `query ReswellShopifyDefaultPackage {
  shippingPackages(first: 100) {
    nodes { ${PACKAGE_FIELDS} }
  }
}`

export const SHOPIFY_DEFAULT_PACKAGE_SHOP_QUERY = `query ReswellShopifyShopDefaultPackage {
  shop {
    shippingPackages(first: 100) {
      nodes { ${PACKAGE_FIELDS} }
    }
  }
}`

const PACKAGE_QUERIES = [
  SHOPIFY_DEFAULT_PACKAGE_ROOT_QUERY,
  SHOPIFY_DEFAULT_PACKAGE_SHOP_QUERY,
] as const

const unsupportedQueries = new Set<string>()
let loggedPackageFieldUnavailable = false

export function resetShopifyDefaultPackageSupportForTests(): void {
  unsupportedQueries.clear()
  loggedPackageFieldUnavailable = false
}

function packageNodes(payload: unknown): unknown[] {
  const parsed = shopifyDefaultPackageResponseSchema.safeParse(payload)
  if (!parsed.success) return []
  const connections = [
    parsed.data.shippingPackages,
    parsed.data.shop?.shippingPackages,
  ]
  const nodes: unknown[] = []
  for (const connection of connections) {
    if (!connection) continue
    if (connection.nodes?.length) nodes.push(...connection.nodes)
    for (const edge of connection.edges ?? []) {
      if (edge?.node != null) nodes.push(edge.node)
    }
  }
  return nodes
}

function lengthInches(value: number, unit: string): number | null {
  switch (unit.trim().toUpperCase()) {
    case "INCHES":
    case "INCH":
    case "IN":
      return value
    case "FEET":
    case "FOOT":
    case "FT":
      return value * 12
    case "YARDS":
    case "YARD":
    case "YD":
      return value * 36
    case "CENTIMETERS":
    case "CENTIMETER":
    case "CM":
      return lengthToInches(value, "cm")
    case "MILLIMETERS":
    case "MILLIMETER":
    case "MM":
      return lengthToInches(value / 10, "cm")
    case "METERS":
    case "METER":
    case "M":
      return lengthToInches(value * 100, "cm")
    default:
      return null
  }
}

function weightPounds(value: number, unit: string): number | null {
  switch (unit.trim().toUpperCase()) {
    case "POUNDS":
    case "POUND":
    case "LB":
    case "LBS":
      return value
    case "OUNCES":
    case "OUNCE":
    case "OZ":
      return weightToLb(value, "oz")
    case "KILOGRAMS":
    case "KILOGRAM":
    case "KG":
      return weightToLb(value, "kg")
    case "GRAMS":
    case "GRAM":
    case "G":
      return weightToLb(value / 1000, "kg")
    default:
      return null
  }
}

function packageName(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").replace(/\s+/g, " ").trim()
  if (!trimmed) return SHOP_STORE_DEFAULT_PACKAGE_NAME
  return trimmed.slice(0, 48)
}

function toStoredPackage(pkg: ShopifyShippingPackage): ShopSavedPackedSize | null {
  if (!pkg.dimensions || !pkg.weight) return null
  const lengthIn = lengthInches(pkg.dimensions.length, pkg.dimensions.unit)
  const widthIn = lengthInches(pkg.dimensions.width, pkg.dimensions.unit)
  const heightIn = lengthInches(pkg.dimensions.height, pkg.dimensions.unit)
  const weightLb = weightPounds(pkg.weight.value, pkg.weight.unit)
  if (
    lengthIn == null ||
    widthIn == null ||
    heightIn == null ||
    weightLb == null
  ) {
    return null
  }
  const stored = readShopShippingDefaults({
    ...EMPTY_SHOP_SHIPPING_DEFAULTS,
    storeDefault: {
      id: SHOP_STORE_DEFAULT_ID,
      name: packageName(pkg.name),
      lengthIn,
      widthIn,
      heightIn,
      weightLb,
      presetId: null,
    },
  })
  return stored.storeDefault
}

/**
 * The package Shopify marks as the store default, in the shop-box shape
 * Reswell already stores. Missing or unusable measurements return null.
 */
export function shopSavedPackageFromShopifyDefaultPackageResponse(
  payload: unknown,
): ShopSavedPackedSize | null {
  for (const node of packageNodes(payload)) {
    const parsed = shopifyShippingPackageSchema.safeParse(node)
    if (!parsed.success || parsed.data.default !== true) continue
    const stored = toStoredPackage(parsed.data)
    if (stored) return stored
    return null
  }
  return null
}

function isUnknownFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ""
  return /doesn't exist on type|Cannot query field|is not defined/i.test(message)
}

export async function fetchShopifyDefaultShippingPackage(input: {
  shopDomain: string
  accessToken: string
}): Promise<ShopSavedPackedSize | null> {
  for (const query of PACKAGE_QUERIES) {
    if (unsupportedQueries.has(query)) continue
    try {
      const data = await shopifyGraphqlRequest<unknown>({
        shopDomain: input.shopDomain,
        accessToken: input.accessToken,
        query,
      })
      return shopSavedPackageFromShopifyDefaultPackageResponse(data)
    } catch (error) {
      if (isUnknownFieldError(error)) {
        unsupportedQueries.add(query)
        continue
      }
      console.error("[shopifyDefaultPackage] read", {
        shopDomain: input.shopDomain,
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Shopify package read failed",
      })
      return null
    }
  }
  if (
    !loggedPackageFieldUnavailable &&
    PACKAGE_QUERIES.every((query) => unsupportedQueries.has(query))
  ) {
    loggedPackageFieldUnavailable = true
    console.error("[shopifyDefaultPackage] read", {
      shopDomain: input.shopDomain,
      timestamp: new Date().toISOString(),
      message: "Shopify did not return a default package field",
    })
  }
  return null
}

export async function saveShopifyDefaultPackageIfMissing(input: {
  supabase: SupabaseClient
  userId: string
  shopDomain: string
  accessToken: string
  current?: ShopShippingDefaults
}): Promise<ShopShippingDefaults> {
  const fallback =
    input.current ?? {
      ...EMPTY_SHOP_SHIPPING_DEFAULTS,
      savedPackages: [],
      boardSizes: {},
    }
  try {
    const started =
      input.current ??
      (await fetchListingsDeskProfile(input.supabase, input.userId)).shopShippingDefaults
    if (started.storeDefault) return started

    const pkg = await fetchShopifyDefaultShippingPackage({
      shopDomain: input.shopDomain,
      accessToken: input.accessToken,
    })
    if (!pkg) return started

    const latest = await fetchListingsDeskProfile(input.supabase, input.userId)
    if (latest.shopShippingDefaults.storeDefault) return latest.shopShippingDefaults

    const next: ShopShippingDefaults = {
      ...latest.shopShippingDefaults,
      savedPackages: [...latest.shopShippingDefaults.savedPackages],
      boardSizes: { ...latest.shopShippingDefaults.boardSizes },
      storeDefault: pkg,
    }
    const saved = await saveShopShippingDefaults(input.supabase, input.userId, next)
    if (!saved.ok) {
      console.error("[shopifyDefaultPackage] save", {
        userId: input.userId,
        shopDomain: input.shopDomain,
        timestamp: new Date().toISOString(),
        message: saved.message,
      })
      return latest.shopShippingDefaults
    }
    return next
  } catch (error) {
    console.error("[shopifyDefaultPackage] save", {
      userId: input.userId,
      shopDomain: input.shopDomain,
      timestamp: new Date().toISOString(),
      message:
        error instanceof Error ? error.message : "Could not save the shop shipping default",
    })
    return fallback
  }
}
