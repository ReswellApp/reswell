import type { SupabaseClient } from "@supabase/supabase-js"
import type { CrmContactStatus } from "@/lib/db/crm"
import {
  getCrmContactByEmail,
  insertCrmContact,
  insertCrmInteraction,
  updateCrmContactRow,
} from "@/lib/db/crm"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

export type AdminTerminalGuestCrmInput = {
  adminProfileId: string
  firstName: string
  lastName: string | null
  email: string
  phone: string | null
  orderId: string
  orderNum: string | null
  listingTitle: string
  amountUsd: number
}

const CUSTOMER_STATUSES = new Set<CrmContactStatus>(["lead", "prospect", "active", "inactive"])

async function hasCrmInteractionForOrder(
  supabase: SupabaseClient,
  contactId: string,
  orderId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("crm_interactions")
    .select("id")
    .eq("contact_id", contactId)
    .ilike("notes", `%${orderId}%`)
    .limit(1)
    .maybeSingle()

  return Boolean(data?.id)
}

/**
 * Upsert a walk-in terminal guest into CRM after a successful in-person sale.
 * Idempotent per order — safe on webhook retries and settlement replays.
 */
export async function syncAdminTerminalGuestToCrm(
  supabase: SupabaseClient,
  input: AdminTerminalGuestCrmInput,
): Promise<void> {
  const email = input.email.trim()
  const firstName = input.firstName.trim() || "Walk-in customer"
  if (!email || !firstName) return

  const createdBy = input.adminProfileId.trim()
  if (!createdBy) return

  const displayOrderNum = formatOrderNumForCustomer(input.orderNum, input.orderId)
  const interactionNotes = `In-person terminal purchase — "${input.listingTitle}" for $${input.amountUsd.toFixed(2)}. Order #${displayOrderNum} (${input.orderId}).`

  let contactId: string | null = null
  const existing = await getCrmContactByEmail(supabase, email)

  if (existing) {
    contactId = existing.id
    const patch: Parameters<typeof updateCrmContactRow>[2] = {}

    if (!existing.first_name?.trim()) patch.first_name = firstName
    if (!existing.last_name?.trim() && input.lastName?.trim()) patch.last_name = input.lastName.trim()
    if (!existing.phone?.trim() && input.phone?.trim()) patch.phone = input.phone.trim()
    if (CUSTOMER_STATUSES.has(existing.status)) patch.status = "customer"

    if (Object.keys(patch).length > 0) {
      const { error } = await updateCrmContactRow(supabase, existing.id, patch)
      if (error) {
        console.error("[crmAdminTerminalGuest] update contact:", error)
      }
    }
  } else {
    const { data, error } = await insertCrmContact(supabase, {
      profile_id: null,
      first_name: firstName,
      last_name: input.lastName?.trim() || null,
      email,
      phone: input.phone?.trim() || null,
      source: "external",
      status: "customer",
      priority: "medium",
      notes: "Added from in-person terminal checkout.",
      next_follow_up_at: null,
      assigned_to: null,
      created_by: createdBy,
      last_contacted_at: new Date().toISOString(),
    })

    if (error || !data) {
      console.error("[crmAdminTerminalGuest] insert contact:", error ?? "no row")
      return
    }
    contactId = data.id
  }

  if (!contactId) return

  const alreadyLogged = await hasCrmInteractionForOrder(supabase, contactId, input.orderId)
  if (alreadyLogged) return

  const { error: interactionError } = await insertCrmInteraction(supabase, {
    contact_id: contactId,
    interaction_type: "in_person",
    subject: `Terminal purchase — Order #${displayOrderNum}`,
    notes: interactionNotes,
    created_by: createdBy,
  })

  if (interactionError) {
    console.error("[crmAdminTerminalGuest] log interaction:", interactionError)
  }
}
