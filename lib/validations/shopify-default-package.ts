import { z } from "zod"

const shopifyPackageDimensionsSchema = z.object({
  length: z.number().finite(),
  width: z.number().finite(),
  height: z.number().finite(),
  unit: z.string().trim().min(1).max(32),
})

const shopifyPackageWeightSchema = z.object({
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(32),
})

/** Fields read from Shopify's store default package. Buyer contact is not accepted. */
export const shopifyShippingPackageSchema = z.object({
  name: z.string().max(200).nullish(),
  default: z.boolean().nullish(),
  dimensions: shopifyPackageDimensionsSchema.nullish(),
  weight: shopifyPackageWeightSchema.nullish(),
})

const shopifyShippingPackageConnectionSchema = z.object({
  nodes: z.array(z.unknown()).nullish(),
  edges: z
    .array(
      z.object({
        node: z.unknown().nullish(),
      }),
    )
    .nullish(),
})

export const shopifyDefaultPackageResponseSchema = z.object({
  shippingPackages: shopifyShippingPackageConnectionSchema.nullish(),
  shop: z
    .object({
      shippingPackages: shopifyShippingPackageConnectionSchema.nullish(),
    })
    .nullish(),
})

export type ShopifyShippingPackage = z.infer<typeof shopifyShippingPackageSchema>
