import { z } from "zod"
import { shopShippingDefaultsFromDraft, type ShopShippingDraftInput } from "@/lib/shop-shipping-defaults"

const draftSchema = z.object({
  physicalProduct: z.boolean(),
  dimensionUnit: z.enum(["in", "cm"]),
  weightUnit: z.enum(["lb", "oz", "kg"]),
  name: z.string().max(48),
  presetId: z.string().max(40).nullable(),
  length: z.string().max(16),
  width: z.string().max(16),
  height: z.string().max(16),
  weight: z.string().max(16),
  savedPackages: z
    .array(
      z.object({
        id: z.string().max(40),
        name: z.string().max(48),
        lengthIn: z.number().finite(),
        widthIn: z.number().finite(),
        heightIn: z.number().finite(),
        weightLb: z.number().finite(),
        presetId: z.string().max(40).nullable(),
      }),
    )
    .max(12),
  boardSizes: z.record(z.string(), z.string().max(40)),
})

export const saveShopShippingDefaultsSchema = draftSchema.superRefine((value, ctx) => {
  const normalized = shopShippingDefaultsFromDraft(value as ShopShippingDraftInput)
  if (!normalized.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: normalized.error })
  }
})

export type SaveShopShippingDefaultsInput = z.infer<typeof saveShopShippingDefaultsSchema>
