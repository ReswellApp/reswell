import { z } from "zod"

export const adminSupportInboxViewSchema = z.enum([
  "open",
  "mine",
  "unassigned",
  "new",
  "waiting",
  "claims",
  "overdue",
  "resolved",
  "all",
])

export const adminSupportInboxTypeSchema = z.enum(["all", "general", "order", "claims"])

export const adminSupportInboxSortSchema = z.enum(["smart", "recent", "oldest"])

export const listAdminSupportInboxQuerySchema = z.object({
  view: adminSupportInboxViewSchema.optional().default("open"),
  type: adminSupportInboxTypeSchema.optional().default("all"),
  search: z.string().trim().max(200).optional().default(""),
  sort: adminSupportInboxSortSchema.optional().default("recent"),
  offset: z.number().int().min(0).max(10_000).optional().default(0),
  limit: z.number().int().min(1).max(100).optional().default(50),
  selected_key: z.string().trim().max(80).nullable().optional(),
})

export type ListAdminSupportInboxQuery = z.infer<typeof listAdminSupportInboxQuerySchema>
