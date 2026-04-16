import { z } from "zod"

export const contactMessageSupportStatusSchema = z.enum([
  "new",
  "triaged",
  "ticket_created",
  "resolved",
])

function isHttpOrHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export const updateContactMessageAdminSchema = z
  .object({
    id: z.string().uuid(),
    support_status: contactMessageSupportStatusSchema.optional(),
    ticket_url: z.string().max(2048).optional(),
    internal_notes: z.string().max(20000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.ticket_url === undefined) return
    const t = val.ticket_url.trim()
    if (t === "") return
    if (!isHttpOrHttpsUrl(t)) {
      ctx.addIssue({ code: "custom", message: "Invalid ticket URL", path: ["ticket_url"] })
    }
  })

export type UpdateContactMessageAdminInput = z.infer<typeof updateContactMessageAdminSchema>
