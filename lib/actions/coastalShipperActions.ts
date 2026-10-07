"use server"

import { revalidatePath } from "next/cache"

import {
  addCoastalShipperExclusion,
  removeCoastalShipperExclusion,
  removeCoastalShipperTrip,
  saveCoastalShipperRegions,
  saveCoastalShipperTrip,
  setCoastalShipperDashboardJobStatus,
  setCoastalShipperDashboardRun,
  setCoastalShipperDashboardSchedule,
} from "@/lib/services/coastalShipperDashboard"
import {
  coastalShipperDeleteExclusionSchema,
  coastalShipperDeleteTripSchema,
  coastalShipperExclusionSchema,
  coastalShipperJobStatusSchema,
  coastalShipperRegionsSchema,
  coastalShipperRunToggleSchema,
  coastalShipperScheduleToggleSchema,
  coastalShipperTripSchema,
} from "@/lib/validations/coastal-delivery"

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}): string {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((messages) => messages && messages.length > 0)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

function revalidateShipper(shipperId: string) {
  revalidatePath("/dashboard/shipper")
  revalidatePath("/admin/shipper")
  revalidatePath(`/admin/shipper/${shipperId}`)
  revalidatePath("/admin/shipper/preview")
}

export async function setCoastalShipperScheduleAction(raw: unknown) {
  const parsed = coastalShipperScheduleToggleSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await setCoastalShipperDashboardSchedule(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateShipper(parsed.data.shipperId)
  return { success: true as const }
}

export async function setCoastalShipperRunAction(raw: unknown) {
  const parsed = coastalShipperRunToggleSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await setCoastalShipperDashboardRun(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateShipper(parsed.data.shipperId)
  return { success: true as const }
}

export async function setCoastalShipperJobStatusAction(raw: unknown) {
  const parsed = coastalShipperJobStatusSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await setCoastalShipperDashboardJobStatus(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateShipper(parsed.data.shipperId)
  return { success: true as const }
}

export async function saveCoastalShipperTripAction(raw: unknown) {
  const parsed = coastalShipperTripSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await saveCoastalShipperTrip(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateShipper(parsed.data.shipperId)
  return { success: true as const }
}

export async function removeCoastalShipperTripAction(raw: unknown) {
  const parsed = coastalShipperDeleteTripSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await removeCoastalShipperTrip(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateShipper(parsed.data.shipperId)
  return { success: true as const }
}

export async function saveCoastalShipperRegionsAction(raw: unknown) {
  const parsed = coastalShipperRegionsSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await saveCoastalShipperRegions(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateShipper(parsed.data.shipperId)
  return { success: true as const }
}

export async function addCoastalShipperExclusionAction(raw: unknown) {
  const parsed = coastalShipperExclusionSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await addCoastalShipperExclusion(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateShipper(parsed.data.shipperId)
  return { success: true as const }
}

export async function removeCoastalShipperExclusionAction(raw: unknown) {
  const parsed = coastalShipperDeleteExclusionSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await removeCoastalShipperExclusion(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateShipper(parsed.data.shipperId)
  return { success: true as const }
}
