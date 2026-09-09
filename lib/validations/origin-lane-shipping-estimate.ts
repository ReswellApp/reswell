import { z } from "zod"

export const originLaneShippingEstimateSchema = z.object({
  originZip: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Enter a 5-digit US ZIP code"),
  weightOz: z
    .number()
    .positive("Weight must be greater than zero")
    .max(960, "Weight looks too high for a single surfboard shipment"),
  lengthIn: z.number().positive().max(130, "Length must be 130 in or less"),
  widthIn: z.number().positive().max(40, "Width must be 40 in or less"),
  heightIn: z.number().positive().max(40, "Height must be 40 in or less"),
})

export type OriginLaneShippingEstimateInput = z.infer<
  typeof originLaneShippingEstimateSchema
>

export type OriginLaneQuote = {
  totalAmount: number
  currency: string
  carrierName: string
  serviceName: string
  sampleCityLabel: string
}
