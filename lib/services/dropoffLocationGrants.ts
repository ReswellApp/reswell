import { requireAdmin } from "@/lib/brands/admin-server"
import { fetchDropoffLocationById } from "@/lib/db/dropoff-locations"
import {
  deleteDropoffLocationGrant,
  getDropoffLocationGrantByUserId,
  listDropoffLocationGrantRows,
  upsertDropoffLocationGrant,
} from "@/lib/db/dropoff-location-grants"
import { resolveDropoffLocationGrantUserId } from "@/lib/services/dropoffLocationAccess"
import { findUserIdByEmail } from "@/lib/services/resolveUserIdByEmail"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type DropoffLocationGrantView = {
  id: string
  userId: string
  email: string | null
  displayName: string | null
  dropoffLocationId: string
  locationName: string
  createdAt: string
}

function loggedFailure(error: unknown, fallback: string): { ok: false; error: string } {
  console.error("[dropoff location grant]", error)
  return { ok: false, error: fallback }
}

export async function listDropoffLocationGrantViews(): Promise<
  { ok: true; grants: DropoffLocationGrantView[] } | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const rows = await listDropoffLocationGrantRows(db)
    if (rows.length === 0) return { ok: true, grants: [] }

    const userIds = [...new Set(rows.map((row) => row.userId))]
    const locationIds = [...new Set(rows.map((row) => row.dropoffLocationId))]
    const [profilesRes, locationsRes] = await Promise.all([
      db.from("profiles").select("id, email, display_name").in("id", userIds),
      db.from("dropoff_locations").select("id, name").in("id", locationIds),
    ])
    if (profilesRes.error) throw profilesRes.error
    if (locationsRes.error) throw locationsRes.error

    const profileById = new Map(
      ((profilesRes.data ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>).map(
        (profile) => [profile.id, profile],
      ),
    )
    const locationName = new Map(
      ((locationsRes.data ?? []) as Array<{ id: string; name: string | null }>).map((location) => [
        location.id,
        location.name?.trim() || "Dropoff",
      ]),
    )

    return {
      ok: true,
      grants: rows.map((row) => {
        const profile = profileById.get(row.userId)
        return {
          id: row.id,
          userId: row.userId,
          email: profile?.email ?? null,
          displayName: profile?.display_name ?? null,
          dropoffLocationId: row.dropoffLocationId,
          locationName: locationName.get(row.dropoffLocationId) ?? "Dropoff",
          createdAt: row.createdAt,
        }
      }),
    }
  } catch (error) {
    return loggedFailure(error, "Could not load dropoff grants.")
  }
}

export async function grantDropoffLocationAccount(input: {
  email: string
  dropoffLocationId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const location = await fetchDropoffLocationById(db, input.dropoffLocationId)
    if (!location) return { ok: false, error: "That dropoff location was not found." }

    const email = input.email.trim()
    const { data, error } = await db.from("profiles").select("id").ilike("email", email).limit(2)
    if (error) throw error
    const profileIds = (Array.isArray(data) ? data : [])
      .map((row) => (row as { id?: unknown }).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
    const authUserId = profileIds.length === 0 ? await findUserIdByEmail(db, email) : null
    const resolved = resolveDropoffLocationGrantUserId({ profileIds, authUserId })
    if ("error" in resolved) return { ok: false, error: resolved.error }

    await upsertDropoffLocationGrant(db, {
      userId: resolved.userId,
      dropoffLocationId: location.id,
      grantedBy: gate.ctx.user.id,
    })
    const saved = await getDropoffLocationGrantByUserId(db, resolved.userId)
    if (!saved) return { ok: false, error: "Could not grant that account." }
    return { ok: true }
  } catch (error) {
    return loggedFailure(error, "Could not grant that account.")
  }
}

export async function revokeDropoffLocationGrant(input: {
  grantId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    await deleteDropoffLocationGrant(db, input.grantId)
    return { ok: true }
  } catch (error) {
    return loggedFailure(error, "Could not remove that grant.")
  }
}
