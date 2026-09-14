"use server"

import { revalidatePath } from "next/cache"

import {
  getDropoffLocationsAdminDashboard,
  updateDropoffListingParcelService,
  updateDropoffLocationService,
} from "@/lib/services/dropoffLocations"
import {
  dropoffListingParcelUpdateSchema,
  dropoffLocationUpdateSchema,
} from "@/lib/validations/dropoff-location"

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}): string {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((msgs) => msgs && msgs.length > 0)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

export async function loadDropoffLocationsAdminDashboardAction() {
  return getDropoffLocationsAdminDashboard()
}

export async function updateDropoffLocationAction(raw: unknown) {
  const parsed = dropoffLocationUpdateSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await updateDropoffLocationService(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidatePath("/admin/dropoff-locations")
  return { success: true as const, location: result.location }
}

export async function updateDropoffListingParcelAction(raw: unknown) {
  const parsed = dropoffListingParcelUpdateSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await updateDropoffListingParcelService(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidatePath("/admin/dropoff-locations")
  return { success: true as const }
}
