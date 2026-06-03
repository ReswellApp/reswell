"use server"

import { createClient } from "@/lib/supabase/server"
import { captureBoardListingRequest } from "@/lib/services/boardListingRequest"
import {
  boardSavedCriteriaHasSpecificity,
} from "@/lib/validations/boardSavedSearch"
import { createBoardListingRequestActionSchema } from "@/lib/validations/boardListingRequest"

export type RequestBoardListingActionResult =
  | { success: true }
  | { error: string }

/**
 * Captures buyer demand from a no-results search ("notify me when listed" /
 * "have Reswell find a seller"). Works for both signed-in and anonymous shoppers.
 */
export async function requestBoardListingAction(
  raw: unknown,
): Promise<RequestBoardListingActionResult> {
  const parsed = createBoardListingRequestActionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Enter a valid email address." }
  }

  const { email, query, criteria, source } = parsed.data

  const hasQuery = Boolean(query?.trim())
  if (!hasQuery && !boardSavedCriteriaHasSpecificity(criteria)) {
    return { error: "Add a search or filter so we know what to look for." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const result = await captureBoardListingRequest({
    email,
    query: query?.trim() || null,
    criteria,
    source,
    userId: user?.id ?? null,
  })

  if (!result.ok) {
    return { error: result.error }
  }

  return { success: true }
}
