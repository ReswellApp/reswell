import { z } from "zod"

/** Path param for `/api/admin/users/[userId]/wallet` */
export const adminWalletUserIdParamSchema = z.string().uuid()
