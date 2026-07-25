/**
 * Ensure a dedicated Auth + profiles row owns Reswell shop inventory.
 *
 * Usage:
 *   npx tsx scripts/ensure-reswell-shop-owner.ts
 *
 * Then set RESWELL_SHOP_OWNER_USER_ID in .env.local / Vercel to the printed UUID.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  DEFAULT_RESWELL_SHOP_OWNER_EMAIL,
} from "@/lib/services/resolveReswellShopOwnerUser"

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  try {
    const content = readFileSync(filePath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!value) continue
      if (process.env[key]?.trim()) continue
      process.env[key] = value
    }
  } catch {
    // optional
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")

const email = (
  process.env.RESWELL_SHOP_OWNER_EMAIL?.trim() || DEFAULT_RESWELL_SHOP_OWNER_EMAIL
).toLowerCase()

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, email, display_name, seller_slug")
    .eq("email", email)
    .maybeSingle()

  let userId = existingProfile?.id as string | undefined

  if (!userId) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: "Reswell",
        full_name: "Reswell",
      },
    })
    if (createErr || !created.user?.id) {
      throw new Error(createErr?.message ?? "Could not create shop owner auth user")
    }
    userId = created.user.id
    console.log(`Created auth user ${userId} <${email}>`)
  } else {
    console.log(`Found existing profile ${userId} <${email}>`)
  }

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      email,
      display_name: "Reswell",
      shop_name: "Reswell Shop",
      seller_slug: null,
      is_shop: false,
      is_admin: false,
      is_employee: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (profileErr) {
    throw new Error(`Could not update shop owner profile: ${profileErr.message}`)
  }

  console.log("")
  console.log("Reswell shop owner ready.")
  console.log(`  RESWELL_SHOP_OWNER_USER_ID=${userId}`)
  console.log(`  RESWELL_SHOP_OWNER_EMAIL=${email}`)
  console.log("")
  console.log("Next:")
  console.log("  1. Add RESWELL_SHOP_OWNER_USER_ID to .env.local and Vercel")
  console.log("  2. npx tsx scripts/backfill-reswell-shop-owner.ts --apply")
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
