"use server"

import { revalidatePath } from "next/cache"

import {
  getListingSurfboardShippedChoice,
  previewSurfboardShippedCheckout,
  saveListingSurfboardShipped,
  type SurfboardShippedCheckoutPreview,
} from "@/lib/services/surfboardShippedOffer"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  previewSurfboardShippedCheckoutSchema,
  saveListingSurfboardShippedSchema,
} from "@/lib/validations/surfboard-shipped"

export async function saveListingSurfboardShippedAction(
  raw: unknown,
): Promise<{ error: string | null }> {
  const parsed = saveListingSurfboardShippedSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the pickup address." }
  }

  const result = await saveListingSurfboardShipped(parsed.data)
  if (!result.error) revalidatePath("/sell/boards")
  return result
}

export async function getListingSurfboardShippedChoiceAction(
  listingId: string,
): Promise<{ enabled: boolean; address: ProfileAddressRow | null } | null> {
  const parsed = previewSurfboardShippedCheckoutSchema.shape.listingId.safeParse(listingId)
  if (!parsed.success) return null
  return getListingSurfboardShippedChoice(parsed.data)
}

export async function previewSurfboardShippedCheckoutAction(
  raw: unknown,
): Promise<SurfboardShippedCheckoutPreview> {
  const hidden: SurfboardShippedCheckoutPreview = {
    available: false,
    feeUsd: 100,
    window: null,
    shippers: [],
    matchedShipperName: null,
    matchedWeekday: null,
  }
  const parsed = previewSurfboardShippedCheckoutSchema.safeParse(raw)
  if (!parsed.success) return hidden
  return previewSurfboardShippedCheckout(parsed.data)
}
