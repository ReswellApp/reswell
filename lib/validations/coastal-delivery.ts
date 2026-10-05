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

export const coastalScheduleEnabledSchema = z.object({
  enabled: z.boolean(),
})

export const coastalRunSchema = z.object({
  runId: z.string().uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  direction: z.enum(["northbound", "southbound"]),
  enabled: z.boolean(),
  stopIds: z.array(z.string().uuid()).min(2, "Pick at least two stops.").max(20),
})

export const coastalDeleteRunSchema = z.object({
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

export type CoastalShipperJoinInput = z.infer<typeof coastalShipperJoinSchema>
export type CoastalScheduleEnabledInput = z.infer<typeof coastalScheduleEnabledSchema>
export type CoastalRunInput = z.infer<typeof coastalRunSchema>
export type CoastalSaveDeliveryInput = z.infer<typeof coastalSaveDeliverySchema>
export type CoastalMatchPreviewInput = z.infer<typeof coastalMatchPreviewSchema>
