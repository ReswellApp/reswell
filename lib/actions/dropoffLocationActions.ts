"use server"

import { revalidatePath } from "next/cache"

import {
  grantDropoffLocationAccount,
  revokeDropoffLocationGrant,
} from "@/lib/services/dropoffLocationGrants"
import {
  getDropoffLocationsAdminDashboard,
  updateDropoffListingParcelService,
  updateDropoffLocationService,
} from "@/lib/services/dropoffLocations"
import {
  dropoffListingParcelUpdateSchema,
  dropoffLocationGrantSchema,
  dropoffLocationRevokeSchema,
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

const GRANT_PATHS = ["/admin/dropoff-locations", "/dashboard", "/dashboard/dropoff-location", "/messages"]

export async function grantDropoffLocationAccountAction(raw: unknown) {
  const parsed = dropoffLocationGrantSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await grantDropoffLocationAccount(parsed.data)
  if (!result.ok) return { error: result.error }
  for (const path of GRANT_PATHS) revalidatePath(path)
  return { success: true as const }
}

export async function revokeDropoffLocationGrantAction(raw: unknown) {
  const parsed = dropoffLocationRevokeSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await revokeDropoffLocationGrant(parsed.data)
  if (!result.ok) return { error: result.error }
  for (const path of GRANT_PATHS) revalidatePath(path)
  return { success: true as const }
}

export async function updateDropoffListingParcelAction(raw: unknown) {
  const parsed = dropoffListingParcelUpdateSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await updateDropoffListingParcelService(parsed.data)
  if (!result.ok) return { error: result.error }
  revalidatePath("/admin/dropoff-locations")
  return { success: true as const }
}
