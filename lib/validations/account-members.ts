import { z } from "zod"
import { GRANTABLE_ACCOUNT_ROLES } from "@/lib/account-access/permissions"

export const inviteAccountMemberSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(GRANTABLE_ACCOUNT_ROLES),
})

export const accountMemberIdSchema = z.object({
  memberId: z.string().uuid(),
})

export const setActiveShopAccountSchema = z.object({
  accountId: z.string().uuid().nullable(),
})

export type InviteAccountMemberInput = z.infer<typeof inviteAccountMemberSchema>
