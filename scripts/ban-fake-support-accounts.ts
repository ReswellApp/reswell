import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { banUserAccounts } from "@/lib/services/banUserAccount"
import { deleteMarketplaceMessageAsAdmin } from "@/lib/db/adminMarketplaceMessages"

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  if (!existsSync(filePath)) return
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
}

const BAN_REASON = "Permanent ban: Fraudulent account impersonating Reswell Support."

type FakeSupportAccount = {
  id: string
  display_name: string | null
  email: string | null
  created_at: string
}

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

async function findFakeSupportAccounts(supabase: ReturnType<typeof createClient>) {
  const patterns = [
    "%RESWELL SUPPORT%",
    "%Reswell Support%",
    "%reswell support%",
  ]

  const accountsById = new Map<string, FakeSupportAccount>()

  for (const pattern of patterns) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, display_name, created_at")
      .ilike("display_name", pattern)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(`Error searching for pattern ${pattern}:`, error.message)
      continue
    }

    for (const profile of profiles ?? []) {
      if (!profile.id) continue
      
      // Get the auth user email
      const { data: authData } = await supabase.auth.admin.getUserById(profile.id)
      
      accountsById.set(profile.id, {
        id: profile.id,
        display_name: profile.display_name,
        email: authData.user?.email ?? null,
        created_at: profile.created_at,
      })
    }
  }

  // Filter out legitimate Reswell support accounts
  // Look for accounts that are NOT admin/staff
  const filtered: FakeSupportAccount[] = []
  
  for (const account of accountsById.values()) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", account.id)
      .single()
    
    // Only include non-admin accounts
    if (!profile?.is_admin) {
      filtered.push(account)
    }
  }

  return filtered
}

async function findMessagesFromUsers(
  supabase: ReturnType<typeof createClient>,
  userIds: string[]
): Promise<MessageRow[]> {
  if (userIds.length === 0) return []

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at")
    .in("sender_id", userIds)
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(`Failed to find messages: ${error.message}`)
  }

  return (data ?? []) as MessageRow[]
}

async function deleteMessages(
  supabase: ReturnType<typeof createClient>,
  messages: MessageRow[]
): Promise<{ deleted: number; failed: number; errors: string[] }> {
  const result = {
    deleted: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const message of messages) {
    const deleteResult = await deleteMarketplaceMessageAsAdmin(supabase, message.id)
    
    if (deleteResult.ok) {
      result.deleted += 1
      console.log(`✓ Deleted message ${message.id}`)
    } else {
      result.failed += 1
      const errorMsg = deleteResult.kind === "db_error" 
        ? deleteResult.error.message 
        : "not found"
      result.errors.push(`${message.id}: ${errorMsg}`)
      console.error(`✗ Failed to delete message ${message.id}: ${errorMsg}`)
    }
  }

  return result
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const execute = process.argv.includes("--execute")
  const supabase = createClient(url, key)

  console.log("🔍 Searching for fake support accounts...")
  const fakeAccounts = await findFakeSupportAccounts(supabase)

  if (fakeAccounts.length === 0) {
    console.log("\n✅ No fake support accounts found.")
    return
  }

  console.log(`\n⚠️  Found ${fakeAccounts.length} fake support account(s):\n`)
  
  for (const account of fakeAccounts) {
    console.log(`  ID: ${account.id}`)
    console.log(`  Display Name: ${account.display_name}`)
    console.log(`  Email: ${account.email}`)
    console.log(`  Created: ${account.created_at}`)
    console.log()
  }

  const userIds = fakeAccounts.map((a) => a.id)
  
  console.log("🔍 Searching for messages from these accounts...")
  const messages = await findMessagesFromUsers(supabase, userIds)
  
  console.log(`\n📨 Found ${messages.length} message(s) from fake accounts\n`)

  if (!execute) {
    console.log("DRY RUN - Preview:")
    console.log("==================")
    console.log(`Accounts to ban: ${fakeAccounts.length}`)
    console.log(`Messages to delete: ${messages.length}`)
    console.log("\nAccounts:")
    for (const account of fakeAccounts) {
      console.log(`  - ${account.display_name} (${account.email})`)
    }
    console.log("\nRe-run with --execute to permanently ban these accounts and delete their messages.")
    return
  }

  console.log("\n🚨 EXECUTING - Banning accounts and deleting messages...\n")

  // First, delete all messages
  if (messages.length > 0) {
    console.log("📨 Deleting messages...")
    const deleteResult = await deleteMessages(supabase, messages)
    console.log(`\n✅ Deleted ${deleteResult.deleted} message(s)`)
    if (deleteResult.failed > 0) {
      console.log(`⚠️  Failed to delete ${deleteResult.failed} message(s)`)
      deleteResult.errors.forEach((err) => console.error(`   ${err}`))
    }
  }

  // Then ban all accounts
  console.log("\n🔒 Banning accounts...")
  const banResult = await banUserAccounts(supabase, userIds, BAN_REASON)
  
  console.log(`\n✅ Banned ${banResult.banned.length} account(s)`)
  if (banResult.failed.length > 0) {
    console.log(`⚠️  Failed to ban ${banResult.failed.length} account(s)`)
    banResult.failed.forEach(({ userId, error }) => 
      console.error(`   ${userId}: ${error}`)
    )
  }

  console.log("\n✅ COMPLETE")
  console.log("===================")
  console.log(`Total accounts banned: ${banResult.banned.length}`)
  console.log(`Total messages deleted: ${messages.length}`)
  
  if (banResult.failed.length > 0 || messages.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("❌ Error:", err instanceof Error ? err.message : err)
  process.exit(1)
})
