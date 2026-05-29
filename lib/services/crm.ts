import { createClient } from "@/lib/supabase/server"
import {
  addCrmContactTagRow,
  bulkDeleteCrmContactRows,
  bulkUpdateCrmContactRows,
  deleteCrmBoardInterestRow,
  deleteCrmContactRow,
  deleteCrmTagRow,
  getCrmContactByProfileId,
  insertCrmBoardInterest,
  insertCrmContact,
  insertCrmInteraction,
  insertCrmTag,
  removeCrmContactTagRow,
  updateCrmBoardInterestRow,
  updateCrmContactRow,
} from "@/lib/db/crm"
import {
  addCrmContactTagSchema,
  assignCrmContactSchema,
  bulkDeleteCrmContactsSchema,
  bulkUpdateCrmContactsSchema,
  createCrmBoardInterestSchema,
  createCrmContactFromProfileSchema,
  createCrmExternalContactSchema,
  createCrmTagSchema,
  deleteCrmBoardInterestSchema,
  deleteCrmContactSchema,
  deleteCrmTagSchema,
  logCrmInteractionSchema,
  markCrmContactedSchema,
  removeCrmContactTagSchema,
  updateCrmBoardInterestSchema,
  updateCrmContactSchema,
} from "@/lib/validations/crm"

type ServiceError = { error: string }
type ServiceSuccess = { success: true }

async function requireStaffUserId(): Promise<{ userId: string } | ServiceError> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in required" }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (error || (!profile?.is_admin && !profile?.is_employee)) {
    return { error: "Forbidden" }
  }
  return { userId: user.id }
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string | null } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "Reswell user", lastName: null }
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

export async function createCrmContactFromProfileService(
  raw: unknown,
): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = createCrmContactFromProfileSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid profile selection" }

  const supabase = await createClient()
  const existing = await getCrmContactByProfileId(supabase, parsed.data.profileId)
  if (existing) return { error: "This profile is already in the CRM" }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("id", parsed.data.profileId)
    .maybeSingle()

  if (profileError || !profile) return { error: "Profile not found" }

  const { firstName, lastName } = splitDisplayName(String(profile.display_name ?? ""))
  const result = await insertCrmContact(supabase, {
    profile_id: profile.id,
    first_name: firstName,
    last_name: lastName,
    email: profile.email ? String(profile.email) : null,
    phone: null,
    source: "profile",
    status: "lead",
    priority: "medium",
    notes: null,
    next_follow_up_at: null,
    assigned_to: null,
    created_by: auth.userId,
  })

  if (result.error) return { error: result.error }
  return { success: true }
}

export async function createCrmExternalContactService(
  raw: unknown,
): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = createCrmExternalContactSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.firstName?.[0] ?? "Invalid contact details"
    return { error: msg }
  }

  const supabase = await createClient()
  const result = await insertCrmContact(supabase, {
    profile_id: null,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    source: "external",
    status: parsed.data.status,
    priority: parsed.data.priority,
    notes: parsed.data.notes ?? null,
    next_follow_up_at: parsed.data.nextFollowUpAt ?? null,
    assigned_to: null,
    created_by: auth.userId,
  })

  if (result.error) return { error: result.error }
  return { success: true }
}

export async function updateCrmContactService(raw: unknown): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = updateCrmContactSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid update" }

  const patch: Record<string, unknown> = {}
  if (parsed.data.firstName !== undefined) patch.first_name = parsed.data.firstName
  if (parsed.data.lastName !== undefined) patch.last_name = parsed.data.lastName
  if (parsed.data.email !== undefined) patch.email = parsed.data.email === "" ? null : parsed.data.email
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone
  if (parsed.data.status !== undefined) patch.status = parsed.data.status
  if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes
  if (parsed.data.nextFollowUpAt !== undefined) patch.next_follow_up_at = parsed.data.nextFollowUpAt
  if (parsed.data.assignedTo !== undefined) patch.assigned_to = parsed.data.assignedTo

  const supabase = await createClient()
  const result = await updateCrmContactRow(supabase, parsed.data.contactId, patch)
  if (result.error) return { error: result.error }
  return { success: true }
}

export async function assignCrmContactService(raw: unknown): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = assignCrmContactSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid assignment" }

  const supabase = await createClient()
  const result = await updateCrmContactRow(supabase, parsed.data.contactId, {
    assigned_to: parsed.data.assignedTo,
  })
  if (result.error) return { error: result.error }
  return { success: true }
}

export async function createCrmTagService(raw: unknown): Promise<(ServiceSuccess & { tagId: string }) | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = createCrmTagSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.name?.[0] ?? "Invalid tag"
    return { error: msg }
  }

  const supabase = await createClient()
  const result = await insertCrmTag(supabase, {
    name: parsed.data.name,
    color: parsed.data.color,
    created_by: auth.userId,
  })
  if (result.error || !result.data) {
    const message = result.error?.toLowerCase().includes("duplicate")
      ? "A tag with that name already exists"
      : result.error ?? "Could not create tag"
    return { error: message }
  }
  return { success: true, tagId: result.data.id }
}

export async function deleteCrmTagService(raw: unknown): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = deleteCrmTagSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid tag" }

  const supabase = await createClient()
  const result = await deleteCrmTagRow(supabase, parsed.data.tagId)
  if (result.error) return { error: result.error }
  return { success: true }
}

export async function addCrmContactTagService(raw: unknown): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = addCrmContactTagSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid tag assignment" }

  const supabase = await createClient()
  const result = await addCrmContactTagRow(supabase, parsed.data.contactId, parsed.data.tagId)
  if (result.error) return { error: result.error }
  return { success: true }
}

export async function removeCrmContactTagService(raw: unknown): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = removeCrmContactTagSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid tag assignment" }

  const supabase = await createClient()
  const result = await removeCrmContactTagRow(supabase, parsed.data.contactId, parsed.data.tagId)
  if (result.error) return { error: result.error }
  return { success: true }
}

export async function deleteCrmContactService(raw: unknown): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = deleteCrmContactSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid contact" }

  const supabase = await createClient()
  const result = await deleteCrmContactRow(supabase, parsed.data.contactId)
  if (result.error) return { error: result.error }
  return { success: true }
}

export async function bulkUpdateCrmContactsService(
  raw: unknown,
): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = bulkUpdateCrmContactsSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid bulk update" }

  const patch: Partial<{
    status: typeof parsed.data.status
    priority: typeof parsed.data.priority
    last_contacted_at: string
  }> = {}
  if (parsed.data.status !== undefined) patch.status = parsed.data.status
  if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority
  if (parsed.data.markContacted) patch.last_contacted_at = new Date().toISOString()

  const supabase = await createClient()
  const result = await bulkUpdateCrmContactRows(supabase, parsed.data.contactIds, patch)
  if (result.error) return { error: result.error }
  return { success: true }
}

export async function bulkDeleteCrmContactsService(
  raw: unknown,
): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = bulkDeleteCrmContactsSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid selection" }

  const supabase = await createClient()
  const result = await bulkDeleteCrmContactRows(supabase, parsed.data.contactIds)
  if (result.error) return { error: result.error }
  return { success: true }
}

export async function createCrmBoardInterestService(
  raw: unknown,
): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = createCrmBoardInterestSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors
    const msg =
      flat.listingId?.[0] ??
      flat.brandModelId?.[0] ??
      flat.brandId?.[0] ??
      flat.customDescription?.[0] ??
      "Invalid board interest"
    return { error: msg }
  }

  const supabase = await createClient()
  const result = await insertCrmBoardInterest(supabase, {
    contact_id: parsed.data.contactId,
    interest_type: parsed.data.interestType,
    listing_id: parsed.data.listingId ?? null,
    brand_model_id: parsed.data.brandModelId ?? null,
    brand_id: parsed.data.brandId ?? null,
    custom_description: parsed.data.customDescription ?? null,
    brand: parsed.data.brand ?? null,
    model: parsed.data.model ?? null,
    dimensions: parsed.data.dimensions ?? null,
    budget_min: parsed.data.budgetMin ?? null,
    budget_max: parsed.data.budgetMax ?? null,
    status: parsed.data.status,
    notes: parsed.data.notes ?? null,
  })

  if (result.error) return { error: result.error }
  return { success: true }
}

export async function updateCrmBoardInterestService(
  raw: unknown,
): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = updateCrmBoardInterestSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid update" }

  const patch: Record<string, unknown> = {}
  if (parsed.data.status !== undefined) patch.status = parsed.data.status
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes
  if (parsed.data.customDescription !== undefined) patch.custom_description = parsed.data.customDescription
  if (parsed.data.brand !== undefined) patch.brand = parsed.data.brand
  if (parsed.data.model !== undefined) patch.model = parsed.data.model
  if (parsed.data.dimensions !== undefined) patch.dimensions = parsed.data.dimensions
  if (parsed.data.budgetMin !== undefined) patch.budget_min = parsed.data.budgetMin
  if (parsed.data.budgetMax !== undefined) patch.budget_max = parsed.data.budgetMax

  const supabase = await createClient()
  const result = await updateCrmBoardInterestRow(supabase, parsed.data.interestId, patch)
  if (result.error) return { error: result.error }
  return { success: true }
}

export async function deleteCrmBoardInterestService(
  raw: unknown,
): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = deleteCrmBoardInterestSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid interest" }

  const supabase = await createClient()
  const result = await deleteCrmBoardInterestRow(supabase, parsed.data.interestId)
  if (result.error) return { error: result.error }
  return { success: true }
}

export async function logCrmInteractionService(raw: unknown): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = logCrmInteractionSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.notes?.[0] ?? "Invalid interaction"
    return { error: msg }
  }

  const supabase = await createClient()
  const result = await insertCrmInteraction(supabase, {
    contact_id: parsed.data.contactId,
    interaction_type: parsed.data.interactionType,
    subject: parsed.data.subject ?? null,
    notes: parsed.data.notes,
    created_by: auth.userId,
  })

  if (result.error) return { error: result.error }
  return { success: true }
}

export async function markCrmContactedService(raw: unknown): Promise<ServiceSuccess | ServiceError> {
  const auth = await requireStaffUserId()
  if ("error" in auth) return auth

  const parsed = markCrmContactedSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid request" }

  const supabase = await createClient()
  const result = await updateCrmContactRow(supabase, parsed.data.contactId, {
    last_contacted_at: new Date().toISOString(),
    next_follow_up_at: parsed.data.nextFollowUpAt ?? null,
  })

  if (result.error) return { error: result.error }
  return { success: true }
}
