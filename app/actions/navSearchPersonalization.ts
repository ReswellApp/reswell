'use server'

import { createClient } from "@/lib/supabase/server"
import {
  loadNavSearchPersonalizationForUser,
  recordNavRecentlyViewedBrandForUser,
  recordNavRecentlyViewedListingForUser,
  recordNavSearchPersonalizationQuery,
  removeNavSearchPersonalizationQuery,
} from "@/lib/services/navSearchPersonalization"
import type { NavSearchPersonalization } from "@/lib/types/nav-search-personalization"

export async function getNavSearchPersonalizationAction(): Promise<
  NavSearchPersonalization | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  return loadNavSearchPersonalizationForUser(user.id)
}

export async function recordNavSearchPersonalizationQueryAction(
  query: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  await recordNavSearchPersonalizationQuery(user.id, query)
  return { ok: true }
}

export async function removeNavSearchPersonalizationQueryAction(
  query: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  await removeNavSearchPersonalizationQuery(user.id, query)
  return { ok: true }
}

export async function recordNavRecentlyViewedListingAction(
  listingId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  await recordNavRecentlyViewedListingForUser(user.id, listingId)
  return { ok: true }
}

export async function recordNavRecentlyViewedBrandAction(input: {
  name: string
  slug?: string | null
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  await recordNavRecentlyViewedBrandForUser(user.id, input)
  return { ok: true }
}
