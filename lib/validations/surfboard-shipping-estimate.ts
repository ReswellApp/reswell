import { z } from "zod"

const trimmed = z.string().trim()

const addressSchema = z.object({
  name: trimmed.max(120).optional().default(""),
  phone: trimmed.max(40).optional().default(""),
  company_name: trimmed.max(120).optional().default(""),
  address_line1: trimmed.min(4, "Street address is required").max(200),
  address_line2: trimmed.max(200).optional().default(""),
  city_locality: trimmed.min(2, "City is required").max(100),
  state_province: trimmed.min(2, "State is required").max(40),
  postal_code: trimmed.regex(/^\d{5}(-\d{4})?$/, "Use a 5-digit or ZIP+4 US postal code"),
  country_code: z.literal("US"),
  residential: z.enum(["yes", "no", "unknown"]),
})

export const surfboardShippingEstimateSchema = z.object({
  shipFrom: addressSchema,
  shipTo: addressSchema,
  /** Packed weight in ounces (ShipEngine). */
  weightOz: z
    .number()
    .positive("Weight must be greater than zero")
    .max(960, "Weight looks too high for a single surfboard shipment"),
  lengthIn: z
    .number()
    .positive()
    .max(130, "Length must be 130 in or less"),
  widthIn: z
    .number()
    .positive()
    .max(40, "Width must be 40 in or less"),
  heightIn: z
    .number()
    .positive()
    .max(40, "Height must be 40 in or less"),
})

export type SurfboardShippingEstimateInput = z.infer<typeof surfboardShippingEstimateSchema>
