import { z } from "zod"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))

export const coastalShipperJoinSchema = z.object({
  displayName: z.string().trim().min(2, "Enter a name buyers would recognize.").max(80),
  phone: optionalText(40),
  notes: optionalText(500),
})

export const coastalShipperEnrollSchema = coastalShipperJoinSchema.extend({
  email: z.string().trim().email("Enter the account email.").max(200),
})

export const coastalScheduleEnabledSchema = z.object({
  shipperId: z.string().uuid(),
  enabled: z.boolean(),
})

export const coastalRunSchema = z.object({
  shipperId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  direction: z.enum(["northbound", "southbound"]),
  enabled: z.boolean(),
  stopIds: z.array(z.string().uuid()).min(2, "Pick at least two stops.").max(20),
})

export const coastalDeleteRunSchema = z.object({
  shipperId: z.string().uuid(),
  runId: z.string().uuid(),
})

export const coastalMatchPreviewSchema = z.object({
  pickupStopId: z.string().uuid(),
  dropoffStopId: z.string().uuid(),
})

export const coastalSaveDeliverySchema = z
  .object({
    listingId: z.string().uuid(),
    whiteGlove: z.boolean(),
    pickupStopId: z.string().uuid().optional(),
    sellerOriginLabel: optionalText(200),
    dropoffStopId: z.string().uuid().optional(),
    shipperId: z.string().uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.whiteGlove) return
    if (!value.pickupStopId) {
      ctx.addIssue({ code: "custom", path: ["pickupStopId"], message: "Choose a pickup stop." })
    }
    if (!value.dropoffStopId) {
      ctx.addIssue({ code: "custom", path: ["dropoffStopId"], message: "Choose a drop-off stop." })
    }
    if (value.pickupStopId && value.dropoffStopId && value.pickupStopId === value.dropoffStopId) {
      ctx.addIssue({
        code: "custom",
        path: ["dropoffStopId"],
        message: "Pickup and drop-off need to be different stops.",
      })
    }
  })

export const coastalShipperScheduleToggleSchema = z.object({
  shipperId: z.string().uuid(),
  enabled: z.boolean(),
})

export const coastalShipperRunToggleSchema = z.object({
  shipperId: z.string().uuid(),
  runId: z.string().uuid(),
  enabled: z.boolean(),
})

export const coastalShipperJobStatusSchema = z.object({
  shipperId: z.string().uuid(),
  requestId: z.string().uuid(),
  status: z.enum(["waiting_for_run", "picked_up", "dropped_off", "cancelled"]),
})

export const coastalShipperPriceSchema = z.object({
  shipperId: z.string().uuid(),
  priceUsd: z
    .number()
    .int()
    .min(20, "Enter a whole-dollar price from $20 to $500.")
    .max(500, "Enter a whole-dollar price from $20 to $500."),
})

export const coastalShipperTripSchema = z.object({
  shipperId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  direction: z.enum(["northbound", "southbound"]),
  enabled: z.boolean(),
  stopIds: z.array(z.string().uuid()).min(2).max(20),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
})

export const coastalShipperDeleteTripSchema = z.object({
  shipperId: z.string().uuid(),
  runId: z.string().uuid(),
})

export const coastalShipperRegionsSchema = z.object({
  shipperId: z.string().uuid(),
  stopIds: z.array(z.string().uuid()).max(20),
})

export const coastalShipperExclusionSchema = z.object({
  shipperId: z.string().uuid(),
  kind: z.enum(["area", "address"]),
  label: z.string().trim().min(2).max(160),
})

export const coastalShipperDeleteExclusionSchema = z.object({
  shipperId: z.string().uuid(),
  exclusionId: z.string().uuid(),
})

export type CoastalShipperJoinInput = z.infer<typeof coastalShipperJoinSchema>
export type CoastalScheduleEnabledInput = z.infer<typeof coastalScheduleEnabledSchema>
export type CoastalRunInput = z.infer<typeof coastalRunSchema>
export type CoastalSaveDeliveryInput = z.infer<typeof coastalSaveDeliverySchema>
export type CoastalMatchPreviewInput = z.infer<typeof coastalMatchPreviewSchema>
export type CoastalShipperScheduleToggleInput = z.infer<typeof coastalShipperScheduleToggleSchema>
export type CoastalShipperRunToggleInput = z.infer<typeof coastalShipperRunToggleSchema>
export type CoastalShipperJobStatusInput = z.infer<typeof coastalShipperJobStatusSchema>
