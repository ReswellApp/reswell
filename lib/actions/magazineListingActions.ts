"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  createMagazineListingSchema,
  updateMagazineListingSchema,
} from "@/lib/validations/magazine-listing"
import { createMagazineListing, updateMagazineListing } from "@/lib/services/magazineListing"
import { actorCanManageMagazineListings } from "@/lib/services/magazineListingSeller"

export type CreateMagazineListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateMagazineListingActionResult = { success: true; slug: string } | { error: string }

async function requireMagazineListingManagerAction(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Please sign in." }
  }
  const allowed = await actorCanManageMagazineListings(supabase, user.id)
  if (!allowed) {
    return { ok: false, error: "You do not have permission to manage magazine listings." }
  }
  return { ok: true, supabase, userId: user.id }
}

export async function createMagazineListingAction(
  raw: unknown,
): Promise<CreateMagazineListingActionResult> {
  const auth = await requireMagazineListingManagerAction()
  if (!auth.ok) return { error: auth.error }

  const parsed = createMagazineListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  try {
    const result = await createMagazineListing(auth.supabase, auth.userId, parsed.data)
    revalidatePath("/magazines")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createMagazineListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish this magazine listing. Please try again." }
  }
}

export async function updateMagazineListingAction(
  raw: unknown,
): Promise<UpdateMagazineListingActionResult> {
  const auth = await requireMagazineListingManagerAction()
  if (!auth.ok) return { error: auth.error }

  const parsed = updateMagazineListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  try {
    const result = await updateMagazineListing(
      auth.supabase,
      parsed.data.listingId,
      auth.userId,
      parsed.data,
    )
    revalidatePath("/magazines")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateMagazineListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't save this magazine listing. Please try again.",
    }
  }
}
