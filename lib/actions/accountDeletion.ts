"use server"

import { z } from "zod"
import { ACCOUNT_DELETE_CONFIRMATION } from "@/lib/account-deletion"
import { createClient } from "@/lib/supabase/server"
import { deleteMemberAccountService } from "@/lib/services/accountDeletion"

const deleteMyAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((value) => value === ACCOUNT_DELETE_CONFIRMATION, {
      message: `Type ${ACCOUNT_DELETE_CONFIRMATION} to confirm.`,
    }),
})

export type DeleteMyAccountResult = { success: true } | { error: string }

export async function deleteMyAccountAction(raw: unknown): Promise<DeleteMyAccountResult> {
  const parsed = deleteMyAccountSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? `Type ${ACCOUNT_DELETE_CONFIRMATION} to confirm.` }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to delete your account." }

  const result = await deleteMemberAccountService(user)
  if (!result.ok) return { error: result.error }
  return { success: true }
}
