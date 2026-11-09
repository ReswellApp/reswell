"use server"

import { revalidatePath } from "next/cache"
import {
  acceptAccountInvite,
  declineAccountInvite,
  inviteAccountMember,
  revokeAccountMember,
  setActiveShopAccount,
} from "@/lib/services/accountAccess"
import {
  accountMemberIdSchema,
  inviteAccountMemberSchema,
  setActiveShopAccountSchema,
} from "@/lib/validations/account-members"

function revalidateAccountSurfaces() {
  revalidatePath("/dashboard/profile")
  revalidatePath("/dashboard/profile/team")
  revalidatePath("/dashboard/listings")
  revalidatePath("/dashboard/sales")
  revalidatePath("/dashboard/shopify")
  revalidatePath("/dashboard/offers")
  revalidatePath("/messages")
}

export async function inviteAccountMemberAction(raw: unknown) {
  const parsed = inviteAccountMemberSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email." }
  }
  const result = await inviteAccountMember(parsed.data)
  if ("error" in result) return result
  revalidateAccountSurfaces()
  return { success: true as const }
}

export async function revokeAccountMemberAction(raw: unknown) {
  const parsed = accountMemberIdSchema.safeParse(raw)
  if (!parsed.success) return { error: "That person could not be found." }
  const result = await revokeAccountMember(parsed.data.memberId)
  if ("error" in result) return result
  revalidateAccountSurfaces()
  return { success: true as const }
}

export async function acceptAccountInviteAction(raw: unknown) {
  const parsed = accountMemberIdSchema.safeParse(raw)
  if (!parsed.success) return { error: "That invite could not be found." }
  const result = await acceptAccountInvite(parsed.data.memberId)
  if ("error" in result) return result
  revalidateAccountSurfaces()
  return { success: true as const }
}

export async function declineAccountInviteAction(raw: unknown) {
  const parsed = accountMemberIdSchema.safeParse(raw)
  if (!parsed.success) return { error: "That invite could not be found." }
  const result = await declineAccountInvite(parsed.data.memberId)
  if ("error" in result) return result
  revalidateAccountSurfaces()
  return { success: true as const }
}

export async function setActiveShopAccountAction(raw: unknown) {
  const parsed = setActiveShopAccountSchema.safeParse(raw)
  if (!parsed.success) return { error: "Choose an account you belong to." }
  const result = await setActiveShopAccount(parsed.data.accountId)
  if ("error" in result) return result
  revalidateAccountSurfaces()
  return { success: true as const }
}
