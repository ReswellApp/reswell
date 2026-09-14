import { z } from "zod"

export const dropoffBoxRuleSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  minLengthIn: z.number().finite().positive().nullable(),
  maxLengthIn: z.number().finite().positive(),
  maxWidthIn: z.number().finite().positive().nullable(),
  boxLengthIn: z.number().finite().positive(),
  boxWidthIn: z.number().finite().positive(),
  boxHeightIn: z.number().finite().positive(),
  weightLb: z.number().finite().positive(),
})

export const dropoffLocationUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  address_line1: z.string().trim().max(120),
  address_line2: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(2).max(40),
  postal_code: z.string().trim().min(5).max(16),
  phone: z.string().trim().max(40).optional().nullable(),
  hours_note: z.string().trim().max(200).optional().nullable(),
  latitude: z.number().finite().nullable().optional(),
  longitude: z.number().finite().nullable().optional(),
  active: z.boolean(),
  box_rules: z.array(dropoffBoxRuleSchema).min(1).max(12),
})

export const dropoffListingParcelUpdateSchema = z.object({
  listingId: z.string().uuid(),
  lengthIn: z.number().finite().positive(),
  widthIn: z.number().finite().positive(),
  heightIn: z.number().finite().positive(),
  weightLb: z.number().finite().positive(),
})

export type DropoffLocationUpdateInput = z.infer<typeof dropoffLocationUpdateSchema>
export type DropoffListingParcelUpdateInput = z.infer<typeof dropoffListingParcelUpdateSchema>
