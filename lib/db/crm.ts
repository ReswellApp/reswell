import type { SupabaseClient } from "@supabase/supabase-js"

export type CrmContactStatus = "lead" | "prospect" | "active" | "customer" | "inactive"
export type CrmContactPriority = "low" | "medium" | "high"
export type CrmContactSource = "profile" | "external"
export type CrmBoardInterestType = "listing" | "catalog_model" | "custom"
export type CrmBoardInterestStatus = "interested" | "contacted" | "matched" | "fulfilled" | "lost"
export type CrmInteractionType = "call" | "email" | "text" | "in_person" | "note" | "other"

export type CrmContactRow = {
  id: string
  profile_id: string | null
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  source: CrmContactSource
  status: CrmContactStatus
  priority: CrmContactPriority
  notes: string | null
  last_contacted_at: string | null
  next_follow_up_at: string | null
  assigned_to: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type CrmContactProfileEmbed = {
  display_name: string | null
  avatar_url: string | null
  seller_slug: string | null
  email: string | null
}

export type CrmContactWithProfile = CrmContactRow & {
  profile: CrmContactProfileEmbed | null
}

export type CrmBoardInterestRow = {
  id: string
  contact_id: string
  interest_type: CrmBoardInterestType
  listing_id: string | null
  brand_model_id: string | null
  custom_description: string | null
  brand: string | null
  model: string | null
  dimensions: string | null
  budget_min: number | null
  budget_max: number | null
  status: CrmBoardInterestStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type CrmBoardInterestListingEmbed = {
  id: string
  title: string | null
  brand: string | null
  model: string | null
  dimensions: string | null
  price: number | null
  slug: string | null
  status: string | null
}

export type CrmBoardInterestCatalogEmbed = {
  id: string
  name: string
  brands: { name: string } | null
}

export type CrmBoardInterestWithEmbeds = CrmBoardInterestRow & {
  listing: CrmBoardInterestListingEmbed | null
  brand_model: CrmBoardInterestCatalogEmbed | null
}

export type CrmInteractionRow = {
  id: string
  contact_id: string
  interaction_type: CrmInteractionType
  subject: string | null
  notes: string
  created_by: string
  created_at: string
}

export type CrmInteractionWithAuthor = CrmInteractionRow & {
  author: { display_name: string | null; avatar_url: string | null } | null
}

export const CRM_CONTACT_SELECT =
  "id, profile_id, first_name, last_name, email, phone, source, status, priority, notes, last_contacted_at, next_follow_up_at, assigned_to, created_by, created_at, updated_at"

export const CRM_CONTACT_WITH_PROFILE_SELECT = `${CRM_CONTACT_SELECT}, profile:profiles!crm_contacts_profile_id_fkey (display_name, avatar_url, seller_slug, email)`

export const CRM_BOARD_INTEREST_SELECT =
  "id, contact_id, interest_type, listing_id, brand_model_id, custom_description, brand, model, dimensions, budget_min, budget_max, status, notes, created_at, updated_at"

export const CRM_BOARD_INTEREST_WITH_EMBEDS_SELECT = `${CRM_BOARD_INTEREST_SELECT}, listing:listings (id, title, brand, model, dimensions, price, slug, status), brand_model:brand_models (id, name, brands (name))`

export const CRM_INTERACTION_SELECT =
  "id, contact_id, interaction_type, subject, notes, created_by, created_at"

export const CRM_INTERACTION_WITH_AUTHOR_SELECT = `${CRM_INTERACTION_SELECT}, author:profiles!crm_interactions_created_by_fkey (display_name, avatar_url)`

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeCrmContactRow(raw: Record<string, unknown>): CrmContactRow {
  return {
    id: String(raw.id),
    profile_id: raw.profile_id == null ? null : String(raw.profile_id),
    first_name: String(raw.first_name ?? ""),
    last_name: raw.last_name == null || raw.last_name === "" ? null : String(raw.last_name),
    email: raw.email == null || raw.email === "" ? null : String(raw.email),
    phone: raw.phone == null || raw.phone === "" ? null : String(raw.phone),
    source: raw.source === "profile" ? "profile" : "external",
    status: (raw.status as CrmContactStatus) ?? "lead",
    priority: (raw.priority as CrmContactPriority) ?? "medium",
    notes: raw.notes == null || raw.notes === "" ? null : String(raw.notes),
    last_contacted_at: raw.last_contacted_at == null ? null : String(raw.last_contacted_at),
    next_follow_up_at: raw.next_follow_up_at == null ? null : String(raw.next_follow_up_at),
    assigned_to: raw.assigned_to == null ? null : String(raw.assigned_to),
    created_by: String(raw.created_by ?? ""),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? raw.created_at ?? ""),
  }
}

export function normalizeCrmContactWithProfile(raw: Record<string, unknown>): CrmContactWithProfile {
  const base = normalizeCrmContactRow(raw)
  const profileRaw = raw.profile
  let profile: CrmContactProfileEmbed | null = null
  if (profileRaw && typeof profileRaw === "object" && !Array.isArray(profileRaw)) {
    const p = profileRaw as Record<string, unknown>
    profile = {
      display_name: p.display_name == null ? null : String(p.display_name),
      avatar_url: p.avatar_url == null ? null : String(p.avatar_url),
      seller_slug: p.seller_slug == null ? null : String(p.seller_slug),
      email: p.email == null ? null : String(p.email),
    }
  }
  return { ...base, profile }
}

export function normalizeCrmBoardInterestRow(raw: Record<string, unknown>): CrmBoardInterestRow {
  return {
    id: String(raw.id),
    contact_id: String(raw.contact_id),
    interest_type: raw.interest_type as CrmBoardInterestType,
    listing_id: raw.listing_id == null ? null : String(raw.listing_id),
    brand_model_id: raw.brand_model_id == null ? null : String(raw.brand_model_id),
    custom_description:
      raw.custom_description == null || raw.custom_description === ""
        ? null
        : String(raw.custom_description),
    brand: raw.brand == null || raw.brand === "" ? null : String(raw.brand),
    model: raw.model == null || raw.model === "" ? null : String(raw.model),
    dimensions: raw.dimensions == null || raw.dimensions === "" ? null : String(raw.dimensions),
    budget_min: parseNumber(raw.budget_min),
    budget_max: parseNumber(raw.budget_max),
    status: (raw.status as CrmBoardInterestStatus) ?? "interested",
    notes: raw.notes == null || raw.notes === "" ? null : String(raw.notes),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? raw.created_at ?? ""),
  }
}

export function normalizeCrmBoardInterestWithEmbeds(
  raw: Record<string, unknown>,
): CrmBoardInterestWithEmbeds {
  const base = normalizeCrmBoardInterestRow(raw)
  let listing: CrmBoardInterestListingEmbed | null = null
  if (raw.listing && typeof raw.listing === "object" && !Array.isArray(raw.listing)) {
    const l = raw.listing as Record<string, unknown>
    listing = {
      id: String(l.id),
      title: l.title == null ? null : String(l.title),
      brand: l.brand == null ? null : String(l.brand),
      model: l.model == null ? null : String(l.model),
      dimensions: l.dimensions == null ? null : String(l.dimensions),
      price: parseNumber(l.price),
      slug: l.slug == null ? null : String(l.slug),
      status: l.status == null ? null : String(l.status),
    }
  }
  let brand_model: CrmBoardInterestCatalogEmbed | null = null
  if (raw.brand_model && typeof raw.brand_model === "object" && !Array.isArray(raw.brand_model)) {
    const m = raw.brand_model as Record<string, unknown>
    let brands: { name: string } | null = null
    if (m.brands && typeof m.brands === "object" && !Array.isArray(m.brands)) {
      brands = { name: String((m.brands as Record<string, unknown>).name ?? "") }
    }
    brand_model = {
      id: String(m.id),
      name: String(m.name ?? ""),
      brands,
    }
  }
  return { ...base, listing, brand_model }
}

export function normalizeCrmInteractionRow(raw: Record<string, unknown>): CrmInteractionRow {
  return {
    id: String(raw.id),
    contact_id: String(raw.contact_id),
    interaction_type: raw.interaction_type as CrmInteractionType,
    subject: raw.subject == null || raw.subject === "" ? null : String(raw.subject),
    notes: String(raw.notes ?? ""),
    created_by: String(raw.created_by ?? ""),
    created_at: String(raw.created_at ?? ""),
  }
}

export function normalizeCrmInteractionWithAuthor(raw: Record<string, unknown>): CrmInteractionWithAuthor {
  const base = normalizeCrmInteractionRow(raw)
  let author: { display_name: string | null; avatar_url: string | null } | null = null
  if (raw.author && typeof raw.author === "object" && !Array.isArray(raw.author)) {
    const a = raw.author as Record<string, unknown>
    author = {
      display_name: a.display_name == null ? null : String(a.display_name),
      avatar_url: a.avatar_url == null ? null : String(a.avatar_url),
    }
  }
  return { ...base, author }
}

export function crmContactDisplayName(contact: Pick<CrmContactRow, "first_name" | "last_name">): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || "Unnamed contact"
}

export function crmBoardInterestLabel(interest: CrmBoardInterestWithEmbeds): string {
  if (interest.interest_type === "listing" && interest.listing) {
    const parts = [interest.listing.brand, interest.listing.model, interest.listing.dimensions].filter(Boolean)
    return parts.length > 0 ? parts.join(" · ") : interest.listing.title ?? "Listing"
  }
  if (interest.interest_type === "catalog_model" && interest.brand_model) {
    const brand = interest.brand_model.brands?.name
    return [brand, interest.brand_model.name].filter(Boolean).join(" ")
  }
  return interest.custom_description ?? "Custom board interest"
}

export async function listCrmContacts(
  supabase: SupabaseClient,
  args?: {
    search?: string
    status?: CrmContactStatus | "all"
    priority?: CrmContactPriority | "all"
    source?: CrmContactSource | "all"
  },
): Promise<CrmContactWithProfile[]> {
  let query = supabase
    .from("crm_contacts")
    .select(CRM_CONTACT_WITH_PROFILE_SELECT)
    .order("updated_at", { ascending: false })

  if (args?.status && args.status !== "all") {
    query = query.eq("status", args.status)
  }
  if (args?.priority && args.priority !== "all") {
    query = query.eq("priority", args.priority)
  }
  if (args?.source && args.source !== "all") {
    query = query.eq("source", args.source)
  }
  if (args?.search?.trim()) {
    const q = args.search.trim().replace(/[%_]/g, "")
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
    )
  }

  const { data, error } = await query.limit(500)
  if (error) {
    console.error("listCrmContacts:", error.message)
    return []
  }
  return (data ?? []).map((row) => normalizeCrmContactWithProfile(row as Record<string, unknown>))
}

export async function getCrmContactById(
  supabase: SupabaseClient,
  id: string,
): Promise<CrmContactWithProfile | null> {
  const { data, error } = await supabase
    .from("crm_contacts")
    .select(CRM_CONTACT_WITH_PROFILE_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return null
  return normalizeCrmContactWithProfile(data as Record<string, unknown>)
}

export async function listCrmBoardInterestsForContact(
  supabase: SupabaseClient,
  contactId: string,
): Promise<CrmBoardInterestWithEmbeds[]> {
  const { data, error } = await supabase
    .from("crm_board_interests")
    .select(CRM_BOARD_INTEREST_WITH_EMBEDS_SELECT)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("listCrmBoardInterestsForContact:", error.message)
    return []
  }
  return (data ?? []).map((row) => normalizeCrmBoardInterestWithEmbeds(row as Record<string, unknown>))
}

export async function listCrmInteractionsForContact(
  supabase: SupabaseClient,
  contactId: string,
): Promise<CrmInteractionWithAuthor[]> {
  const { data, error } = await supabase
    .from("crm_interactions")
    .select(CRM_INTERACTION_WITH_AUTHOR_SELECT)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("listCrmInteractionsForContact:", error.message)
    return []
  }
  return (data ?? []).map((row) => normalizeCrmInteractionWithAuthor(row as Record<string, unknown>))
}

export async function insertCrmContact(
  supabase: SupabaseClient,
  row: Omit<CrmContactRow, "id" | "created_at" | "updated_at" | "last_contacted_at"> & {
    last_contacted_at?: string | null
  },
): Promise<{ data: CrmContactRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("crm_contacts")
    .insert(row)
    .select(CRM_CONTACT_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeCrmContactRow(data as Record<string, unknown>), error: null }
}

export async function updateCrmContactRow(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<
    Pick<
      CrmContactRow,
      | "first_name"
      | "last_name"
      | "email"
      | "phone"
      | "status"
      | "priority"
      | "notes"
      | "next_follow_up_at"
      | "assigned_to"
      | "last_contacted_at"
    >
  >,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("crm_contacts").update(patch).eq("id", id)
  return { error: error?.message ?? null }
}

export async function deleteCrmContactRow(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("crm_contacts").delete().eq("id", id)
  return { error: error?.message ?? null }
}

export async function insertCrmBoardInterest(
  supabase: SupabaseClient,
  row: Omit<CrmBoardInterestRow, "id" | "created_at" | "updated_at">,
): Promise<{ data: CrmBoardInterestRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("crm_board_interests")
    .insert(row)
    .select(CRM_BOARD_INTEREST_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeCrmBoardInterestRow(data as Record<string, unknown>), error: null }
}

export async function updateCrmBoardInterestRow(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<
    Pick<
      CrmBoardInterestRow,
      "status" | "notes" | "custom_description" | "brand" | "model" | "dimensions" | "budget_min" | "budget_max"
    >
  >,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("crm_board_interests").update(patch).eq("id", id)
  return { error: error?.message ?? null }
}

export async function deleteCrmBoardInterestRow(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("crm_board_interests").delete().eq("id", id)
  return { error: error?.message ?? null }
}

export async function insertCrmInteraction(
  supabase: SupabaseClient,
  row: Omit<CrmInteractionRow, "id" | "created_at">,
): Promise<{ data: CrmInteractionRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("crm_interactions")
    .insert(row)
    .select(CRM_INTERACTION_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeCrmInteractionRow(data as Record<string, unknown>), error: null }
}

export async function getCrmContactByProfileId(
  supabase: SupabaseClient,
  profileId: string,
): Promise<CrmContactRow | null> {
  const { data, error } = await supabase
    .from("crm_contacts")
    .select(CRM_CONTACT_SELECT)
    .eq("profile_id", profileId)
    .maybeSingle()

  if (error || !data) return null
  return normalizeCrmContactRow(data as Record<string, unknown>)
}

export type CrmStats = {
  totalContacts: number
  needsFollowUp: number
  highPriority: number
  activeInterests: number
}

export async function getCrmStats(supabase: SupabaseClient): Promise<CrmStats> {
  const now = new Date().toISOString()

  const [contactsRes, interestsRes] = await Promise.all([
    supabase.from("crm_contacts").select("id, priority, status, next_follow_up_at, last_contacted_at"),
    supabase
      .from("crm_board_interests")
      .select("id", { count: "exact", head: true })
      .in("status", ["interested", "contacted", "matched"]),
  ])

  const contacts = contactsRes.data ?? []
  const totalContacts = contacts.length
  const needsFollowUp = contacts.filter((c) => {
    if (c.next_follow_up_at && c.next_follow_up_at <= now) return true
    if (!c.last_contacted_at) return true
    return false
  }).length
  const highPriority = contacts.filter(
    (c) => c.priority === "high" && c.status !== "inactive" && c.status !== "customer",
  ).length
  const activeInterests = interestsRes.count ?? 0

  return { totalContacts, needsFollowUp, highPriority, activeInterests }
}
