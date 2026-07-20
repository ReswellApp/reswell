import { z } from "zod"

export const opsSourceSchema = z.enum(["vercel", "supabase", "client", "server"])
export const opsSeveritySchema = z.enum(["critical", "warning", "info"])
export const opsGroupStatusSchema = z.enum(["open", "acknowledged", "resolved", "ignored"])
export const opsTicketStatusSchema = z.enum(["open", "in_progress", "done"])
export const opsTicketPrioritySchema = z.enum(["low", "medium", "high", "urgent"])

export const opsClientReportSchema = z.object({
  source: z.enum(["client", "server"]).default("client"),
  name: z.string().max(200).optional(),
  message: z.string().min(1).max(4000),
  stack: z.string().max(12000).optional(),
  digest: z.string().max(200).optional(),
  url: z.string().max(2000).optional(),
  path: z.string().max(500).optional(),
  release: z.string().max(200).optional(),
  severity: opsSeveritySchema.optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

export const opsUpdateGroupStatusSchema = z.object({
  groupId: z.string().uuid(),
  status: opsGroupStatusSchema,
})

export const opsCreateFixTicketSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().min(2).max(200),
  notes: z.string().max(5000).optional(),
  priority: opsTicketPrioritySchema.optional(),
})

export const opsUpdateFixTicketSchema = z.object({
  ticketId: z.string().uuid(),
  status: opsTicketStatusSchema.optional(),
  notes: z.string().max(5000).optional(),
  priority: opsTicketPrioritySchema.optional(),
})

export type OpsClientReportInput = z.infer<typeof opsClientReportSchema>
