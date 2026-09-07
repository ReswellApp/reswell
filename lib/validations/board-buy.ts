import { z } from "zod"
import {
  BOARD_BUY_MAX_BOX_HEIGHT_IN,
  BOARD_BUY_MAX_BOX_WIDTH_IN,
  BOARD_BUY_MAX_PHOTOS,
  BOARD_BUY_MIN_PHOTOS,
} from "@/lib/board-buy/constants"

const moneySchema = z.coerce.number().finite().gt(0).max(50_000)

const photoUrlSchema = z.string().url().max(2000)

export const boardBuySubmitSchema = z.object({
  title: z.string().trim().min(3).max(120),
  askingPrice: moneySchema,
  sellerNote: z.string().trim().max(2000).optional().nullable(),
  photoUrls: z.array(photoUrlSchema).min(BOARD_BUY_MIN_PHOTOS).max(BOARD_BUY_MAX_PHOTOS),
  shipFromName: z.string().trim().min(2).max(80),
  shipFromPhone: z.string().trim().min(7).max(32),
  shipFromLine1: z.string().trim().min(3).max(120),
  shipFromLine2: z.string().trim().max(120).optional().nullable(),
  shipFromCity: z.string().trim().min(2).max(80),
  shipFromState: z.string().trim().min(2).max(40),
  shipFromPostal: z.string().trim().min(5).max(16),
  parcelLengthIn: z.coerce.number().finite().gt(0).max(140).optional().nullable(),
  parcelWidthIn: z.coerce.number().finite().gt(0).max(BOARD_BUY_MAX_BOX_WIDTH_IN).optional().nullable(),
  parcelHeightIn: z.coerce
    .number()
    .finite()
    .gt(0)
    .max(BOARD_BUY_MAX_BOX_HEIGHT_IN)
    .optional()
    .nullable(),
  parcelWeightLb: z.coerce.number().finite().gt(0).max(150).optional().nullable(),
})

export const boardBuySellerParcelSchema = z.object({
  submissionId: z.string().uuid(),
  parcelLengthIn: z.coerce.number().finite().gt(0).max(140),
  parcelWidthIn: z.coerce.number().finite().gt(0).max(BOARD_BUY_MAX_BOX_WIDTH_IN),
  parcelHeightIn: z.coerce.number().finite().gt(0).max(BOARD_BUY_MAX_BOX_HEIGHT_IN),
  parcelWeightLb: z.coerce.number().finite().gt(0).max(150),
})

export const boardBuyOpsQuoteSchema = z.object({
  submissionId: z.string().uuid(),
  mode: z.enum(["accept_asking", "counter", "decline"]),
  offeredPrice: moneySchema.optional(),
  opsNotes: z.string().trim().max(2000).optional().nullable(),
  quoteMessage: z.string().trim().max(2000).optional().nullable(),
})

export const boardBuySellerRespondSchema = z.object({
  submissionId: z.string().uuid(),
  decision: z.enum(["accept", "decline"]),
})

export const boardBuyIdSchema = z.object({
  submissionId: z.string().uuid(),
})
