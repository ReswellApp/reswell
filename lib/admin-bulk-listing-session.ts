import type { PeerListingSection } from "@/lib/peer-listing-sections"

export const ADMIN_BULK_LISTING_MAX = 50

/** Product types available in admin bulk listing (surfboards, fins, magazines). */
export const ADMIN_BULK_LISTING_SECTIONS = ["surfboards", "fins", "magazines"] as const

export type AdminBulkListingSection = (typeof ADMIN_BULK_LISTING_SECTIONS)[number]

const ADMIN_BULK_LISTING_SECTION_SET = new Set<string>(ADMIN_BULK_LISTING_SECTIONS)

export function isAdminBulkListingSection(
  section: string | null | undefined,
): section is AdminBulkListingSection {
  return section != null && ADMIN_BULK_LISTING_SECTION_SET.has(section)
}

export function assertAdminBulkListingSection(section: PeerListingSection): AdminBulkListingSection {
  if (!isAdminBulkListingSection(section)) {
    throw new Error(`Bulk listing does not support section: ${section}`)
  }
  return section
}

const STORAGE_KEY = "admin_bulk_listing_session"

export type AdminBulkListingSlotStatus = "pending" | "in_progress" | "completed"

export interface AdminBulkListingSlot {
  id: string
  section: PeerListingSection
  status: AdminBulkListingSlotStatus
  listingId?: string
  listingSlug?: string
  title?: string
}

export interface AdminBulkListingSession {
  id: string
  userId: string
  displayName: string
  email: string | null
  createdAt: string
  slots: AdminBulkListingSlot[]
}

function newSlotId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function newSessionId(): string {
  return newSlotId()
}

export function createBulkListingSession(params: {
  userId: string
  displayName: string
  email: string | null
  sections: AdminBulkListingSection[]
}): AdminBulkListingSession {
  const session: AdminBulkListingSession = {
    id: newSessionId(),
    userId: params.userId,
    displayName: params.displayName,
    email: params.email,
    createdAt: new Date().toISOString(),
    slots: params.sections.slice(0, ADMIN_BULK_LISTING_MAX).map((section) => ({
      id: newSlotId(),
      section,
      status: "pending",
    })),
  }
  saveBulkListingSession(session)
  return session
}

export function loadBulkListingSession(): AdminBulkListingSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdminBulkListingSession
    if (!parsed?.id || !parsed.userId || !Array.isArray(parsed.slots)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveBulkListingSession(session: AdminBulkListingSession): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearBulkListingSession(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(STORAGE_KEY)
}

export function appendBulkListingSlots(
  session: AdminBulkListingSession,
  sections: AdminBulkListingSection[],
): AdminBulkListingSession | null {
  const remaining = ADMIN_BULK_LISTING_MAX - session.slots.length
  if (remaining <= 0) return null
  const nextSections = sections.slice(0, remaining)
  if (nextSections.length === 0) return null
  const updated: AdminBulkListingSession = {
    ...session,
    slots: [
      ...session.slots,
      ...nextSections.map((section) => ({
        id: newSlotId(),
        section,
        status: "pending" as const,
      })),
    ],
  }
  saveBulkListingSession(updated)
  return updated
}

export function removeBulkListingSlot(
  session: AdminBulkListingSession,
  slotId: string,
): AdminBulkListingSession {
  const updated: AdminBulkListingSession = {
    ...session,
    slots: session.slots.filter((slot) => slot.id !== slotId),
  }
  saveBulkListingSession(updated)
  return updated
}

export function markBulkListingSlotInProgress(
  session: AdminBulkListingSession,
  slotId: string,
): AdminBulkListingSession {
  const updated: AdminBulkListingSession = {
    ...session,
    slots: session.slots.map((slot) =>
      slot.id === slotId
        ? { ...slot, status: "in_progress" }
        : slot.status === "in_progress"
          ? { ...slot, status: "pending" }
          : slot,
    ),
  }
  saveBulkListingSession(updated)
  return updated
}

export function completeBulkListingSlot(
  session: AdminBulkListingSession,
  slotId: string,
  result: { listingId: string; listingSlug: string; title: string },
): AdminBulkListingSession | null {
  const slot = session.slots.find((s) => s.id === slotId)
  if (!slot) return null
  const updated: AdminBulkListingSession = {
    ...session,
    slots: session.slots.map((s) =>
      s.id === slotId
        ? {
            ...s,
            status: "completed",
            listingId: result.listingId,
            listingSlug: result.listingSlug,
            title: result.title,
          }
        : s,
    ),
  }
  saveBulkListingSession(updated)
  return updated
}

export function getBulkListingSlot(
  session: AdminBulkListingSession,
  slotId: string,
): AdminBulkListingSlot | null {
  return session.slots.find((slot) => slot.id === slotId) ?? null
}

export function getNextPendingBulkSlot(
  session: AdminBulkListingSession,
): AdminBulkListingSlot | null {
  return session.slots.find((slot) => slot.status === "pending") ?? null
}

export function bulkListingProgress(session: AdminBulkListingSession): {
  total: number
  completed: number
  pending: number
} {
  const total = session.slots.length
  const completed = session.slots.filter((slot) => slot.status === "completed").length
  return { total, completed, pending: total - completed }
}

export function isBulkListingSessionComplete(session: AdminBulkListingSession): boolean {
  return session.slots.length > 0 && session.slots.every((slot) => slot.status === "completed")
}
