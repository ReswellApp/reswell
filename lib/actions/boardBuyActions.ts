"use server"

import { revalidatePath } from "next/cache"
import {
  getAdminBoardBuyService,
  getMyBoardBuyService,
  listAdminBoardBuysService,
  listMyBoardBuysService,
  opsMarkReceivedAndPayService,
  opsPurchaseBoardBuyLabelService,
  opsQuoteBoardBuyService,
  sellerRespondBoardBuyService,
  submitBoardBuyService,
  withdrawBoardBuyService,
} from "@/lib/services/boardBuy"
import {
  boardBuyIdSchema,
  boardBuyOpsQuoteSchema,
  boardBuySellerRespondSchema,
  boardBuySubmitSchema,
} from "@/lib/validations/board-buy"

function flattenZod(error: { flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> } }) {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((msgs) => msgs && msgs.length > 0)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

export async function submitBoardBuyAction(input: unknown) {
  const parsed = boardBuySubmitSchema.safeParse(input)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await submitBoardBuyService(parsed.data)
  if ("success" in result) {
    revalidatePath("/dashboard/we-buy")
    revalidatePath("/admin/we-buy")
  }
  return result
}

export async function sellerRespondBoardBuyAction(input: unknown) {
  const parsed = boardBuySellerRespondSchema.safeParse(input)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await sellerRespondBoardBuyService(parsed.data)
  if ("success" in result) {
    revalidatePath(`/dashboard/we-buy/${parsed.data.submissionId}`)
    revalidatePath("/dashboard/we-buy")
    revalidatePath("/admin/we-buy")
  }
  return result
}

export async function withdrawBoardBuyAction(input: unknown) {
  const parsed = boardBuyIdSchema.safeParse(input)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await withdrawBoardBuyService(parsed.data.submissionId)
  if ("success" in result) {
    revalidatePath("/dashboard/we-buy")
    revalidatePath(`/dashboard/we-buy/${parsed.data.submissionId}`)
    revalidatePath("/admin/we-buy")
  }
  return result
}

export async function opsQuoteBoardBuyAction(input: unknown) {
  const parsed = boardBuyOpsQuoteSchema.safeParse(input)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await opsQuoteBoardBuyService(parsed.data)
  if ("success" in result) {
    revalidatePath("/admin/we-buy")
    revalidatePath(`/admin/we-buy/${parsed.data.submissionId}`)
  }
  return result
}

export async function opsPurchaseBoardBuyLabelAction(input: unknown) {
  const parsed = boardBuyIdSchema.safeParse(input)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await opsPurchaseBoardBuyLabelService(parsed.data.submissionId)
  if ("success" in result) {
    revalidatePath(`/admin/we-buy/${parsed.data.submissionId}`)
    revalidatePath(`/dashboard/we-buy/${parsed.data.submissionId}`)
  }
  return result
}

export async function opsMarkReceivedAndPayAction(input: unknown) {
  const parsed = boardBuyIdSchema.safeParse(input)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await opsMarkReceivedAndPayService(parsed.data.submissionId)
  if ("success" in result) {
    revalidatePath(`/admin/we-buy/${parsed.data.submissionId}`)
    revalidatePath("/admin/we-buy")
    revalidatePath("/dashboard/wallet")
    revalidatePath(`/dashboard/we-buy/${parsed.data.submissionId}`)
  }
  return result
}

export async function loadMyBoardBuysAction() {
  return listMyBoardBuysService()
}

export async function loadMyBoardBuyAction(id: string) {
  return getMyBoardBuyService(id)
}

export async function loadAdminBoardBuysAction() {
  return listAdminBoardBuysService()
}

export async function loadAdminBoardBuyAction(id: string) {
  return getAdminBoardBuyService(id)
}
