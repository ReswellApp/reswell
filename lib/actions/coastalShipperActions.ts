"use server"

import { revalidatePath } from "next/cache"

import {
  setCoastalShipperDashboardJobStatus,
  setCoastalShipperDashboardRun,
  setCoastalShipperDashboardSchedule,
} from "@/lib/services/coastalShipperDashboard"
import {
  coastalShipperJobStatusSchema,
  coastalShipperRunToggleSchema,
  coastalShipperScheduleToggleSchema,
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
