import { createServiceRoleClient } from "@/lib/supabase/server"
import { z } from "zod"

const uuidSchema = z.string().uuid()

function normalizeSupportEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Resolves the configured Reswell support teammate (marketplace seller side of DMs). */
export async function resolveSupportRecipientUserId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const byIdRaw = process.env.MESSAGES_DIRECT_SUPPORT_USER_ID?.trim()
  if (byIdRaw) {
    const parsed = uuidSchema.safeParse(byIdRaw)
    if (!parsed.success) {
      return { ok: false, error: "Support chat isn’t configured correctly. Please submit a ticket instead." }
    }
    return { ok: true, userId: parsed.data }
  }

  const byEmailRaw = process.env.MESSAGES_DIRECT_SUPPORT_EMAIL?.trim()
  if (!byEmailRaw) {
    return {
      ok: false,
      error: "Live chat routing isn’t set up yet. Choose a topic and send us a note below—we’ll reply by email.",
    }
  }

  const email = normalizeSupportEmail(byEmailRaw)
  if (!z.string().email().safeParse(email).success) {
    return { ok: false, error: "Support chat isn’t configured correctly. Please submit a ticket instead." }
  }

  try {
    const svc = createServiceRoleClient()
    const { data, error } = await svc.from("profiles").select("id").eq("email", email).maybeSingle()

    if (error || !data?.id) {
      return {
        ok: false,
        error:
          "We couldn’t route you to chat just now. Submit a ticket with the form and our team will help you there.",
      }
    }

    return { ok: true, userId: data.id }
  } catch {
    return { ok: false, error: "Live chat routing isn’t available. Please submit a ticket instead." }
  }
}
