"use server"

import { revalidatePath } from "next/cache"

import {
  joinCoastalShipper,
  matchCoastalPreview,
  removeCoastalRun,
  saveCoastalDeliveryChoice,
  saveCoastalRun,
  setCoastalScheduleEnabled,
} from "@/lib/services/coastalDelivery"
import {
  coastalDeleteRunSchema,
  coastalMatchPreviewSchema,
  coastalRunSchema,
  coastalSaveDeliverySchema,
  coastalScheduleEnabledSchema,
  coastalShipperJoinSchema,
} from "@/lib/validations/coastal-delivery"

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}): string {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((messages) => messages && messages.length > 0)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

function finish(result: { ok: true } | { ok: false; error: string }, paths: string[]) {
  if (!result.ok) return { error: result.error }
  for (const path of paths) revalidatePath(path)
  return { success: true as const }
}

export async function joinCoastalShipperAction(raw: unknown) {
  const parsed = coastalShipperJoinSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await joinCoastalShipper(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidatePath("/admin/coastal-delivery")
  revalidatePath("/admin/coastal-delivery/join")
  revalidatePath("/admin/coastal-delivery/schedule")
  return { success: true as const, profile: result.data.profile }
}

export async function setCoastalScheduleEnabledAction(raw: unknown) {
  const parsed = coastalScheduleEnabledSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  return finish(await setCoastalScheduleEnabled(parsed.data.enabled), [
    "/admin/coastal-delivery",
    "/admin/coastal-delivery/schedule",
    "/admin/coastal-delivery/preview",
  ])
}

export async function saveCoastalRunAction(raw: unknown) {
  const parsed = coastalRunSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  return finish(await saveCoastalRun(parsed.data), [
    "/admin/coastal-delivery",
    "/admin/coastal-delivery/schedule",
    "/admin/coastal-delivery/preview",
  ])
}

export async function deleteCoastalRunAction(raw: unknown) {
  const parsed = coastalDeleteRunSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  return finish(await removeCoastalRun(parsed.data.runId), [
    "/admin/coastal-delivery",
    "/admin/coastal-delivery/schedule",
    "/admin/coastal-delivery/preview",
  ])
}

export async function matchCoastalPreviewAction(raw: unknown) {
  const parsed = coastalMatchPreviewSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await matchCoastalPreview(parsed.data)
  if (!result.ok) return { error: result.error }
  return { success: true as const, match: result.data }
}

export async function saveCoastalDeliveryChoiceAction(raw: unknown) {
  const parsed = coastalSaveDeliverySchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await saveCoastalDeliveryChoice(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidatePath("/admin/coastal-delivery/preview")
  return { success: true as const, saved: result.data.saved }
}
