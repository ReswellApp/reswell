import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")

const UNPUBLISHED_TABLES = [
  "wallets",
  "wallet_transactions",
  "orders",
  "listing_images",
] as const

const SOURCE_ROOTS = ["app", "components", "lib", "apps/mobile/src"] as const

type PostgresChangeBinding = {
  file: string
  table: string
  filter: string | null
}

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "dist" ||
      entry.name.endsWith(".test.ts")
    ) {
      continue
    }
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkSourceFiles(path, acc)
      continue
    }
    if (/\.(ts|tsx)$/.test(entry.name)) acc.push(path)
  }
  return acc
}

function readRepoFile(relPath: string): string {
  return readFileSync(join(repoRoot, relPath), "utf8")
}

function postgresChangeBindings(source: string, file: string): PostgresChangeBinding[] {
  const bindings: PostgresChangeBinding[] = []
  const marker = "postgres_changes"
  let from = 0
  while (true) {
    const index = source.indexOf(marker, from)
    if (index < 0) break
    const slice = source.slice(index, index + 500)
    const table = slice.match(/table:\s*["']([^"']+)["']/)
    const filter = slice.match(/filter:\s*[`'"]([^`'"]+)[`'"]/)
    if (table) {
      bindings.push({
        file,
        table: table[1],
        filter: filter?.[1] ?? null,
      })
    }
    from = index + marker.length
  }
  return bindings
}

function collectAppBindings(): PostgresChangeBinding[] {
  const bindings: PostgresChangeBinding[] = []
  for (const root of SOURCE_ROOTS) {
    const dir = join(repoRoot, root)
    if (!existsSync(dir)) continue
    for (const path of walkSourceFiles(dir)) {
      const source = readFileSync(path, "utf8")
      if (!source.includes("postgres_changes")) continue
      bindings.push(
        ...postgresChangeBindings(source, relative(repoRoot, path).replaceAll("\\", "/")),
      )
    }
  }
  return bindings
}

describe("Realtime subscription scope", () => {
  const bindings = collectAppBindings()

  it("does not subscribe to unpublished tables", () => {
    const unpublished = bindings.filter((binding) =>
      (UNPUBLISHED_TABLES as readonly string[]).includes(binding.table),
    )
    assert.deepEqual(unpublished, [])
    assert.equal(existsSync(join(repoRoot, "components/order-realtime-refresh.tsx")), false)
  })

  it("keeps inbox live updates on conversation filters and private broadcast", () => {
    const inboxSource = readRepoFile("components/features/messages/messages-inbox-context.tsx")
    const liveSource = readRepoFile(
      "components/features/messages/hooks/use-marketplace-inbox-live.ts",
    )
    const inboxBindings = bindings.filter(
      (binding) => binding.file === "components/features/messages/messages-inbox-context.tsx",
    )

    assert.equal(
      inboxBindings.some((binding) => binding.table === "messages"),
      false,
    )
    assert.deepEqual(inboxBindings, [
      {
        file: "components/features/messages/messages-inbox-context.tsx",
        table: "conversations",
        filter: "${column}=eq.${userId}",
      },
    ])
    assert.match(inboxSource, /\["buyer_id", "seller_id"\]/)
    assert.match(inboxSource, /CONVERSATION_INBOX_ACTIVITY_EVENT/)
    assert.match(inboxSource, /MESSAGES_INBOX_REFRESH_EVENT/)
    assert.doesNotMatch(liveSource, /postgres_changes/)
    assert.match(liveSource, /marketplaceInboxChannel\(userId\)/)
    assert.match(liveSource, /MARKETPLACE_THREAD_MESSAGE_EVENT/)
    assert.match(liveSource, /dispatchUnreadCountRefresh/)
  })

  it("keeps thread and mobile message WAL fallbacks conversation-scoped", () => {
    const messageBindings = bindings.filter((binding) => binding.table === "messages")
    assert.ok(messageBindings.length >= 2)
    for (const binding of messageBindings) {
      assert.match(
        binding.filter ?? "",
        /conversation_id=eq\.\$\{conversationId\}/,
        `${binding.file} subscribed to messages without a conversation filter`,
      )
    }
  })

  it("keeps header unread badges on published profile and conversation rows", () => {
    const headerBindings = bindings.filter((binding) => binding.file === "components/header.tsx")
    assert.ok(
      headerBindings.some(
        (binding) => binding.table === "profiles" && binding.filter === "id=eq.${user.id}",
      ),
    )
    assert.ok(
      headerBindings.some(
        (binding) =>
          binding.table === "conversations" && binding.filter === "buyer_id=eq.${user.id}",
      ),
    )
    assert.ok(
      headerBindings.some(
        (binding) =>
          binding.table === "conversations" && binding.filter === "seller_id=eq.${user.id}",
      ),
    )
    assert.equal(
      headerBindings.some((binding) =>
        (UNPUBLISHED_TABLES as readonly string[]).includes(binding.table),
      ),
      false,
    )
  })

  it("does not drop live-chat publication listeners", () => {
    assert.ok(
      bindings.some(
        (binding) =>
          binding.file === "components/features/admin/live-chat-admin-client.tsx" &&
          binding.table === "live_chat_sessions",
      ),
    )
    assert.ok(
      bindings.some(
        (binding) =>
          binding.file === "components/features/admin/live-chat-admin-client.tsx" &&
          binding.table === "live_chat_messages",
      ),
    )
  })

  it("does not broaden supabase_realtime to unpublished tables", () => {
    const publicationSql = [
      readRepoFile("supabase/migrations/20270801150000_messages_realtime_publication.sql"),
      readRepoFile("supabase/migrations/20270806160000_live_chat_support.sql"),
    ].join("\n")

    for (const table of UNPUBLISHED_TABLES) {
      assert.doesNotMatch(
        publicationSql,
        new RegExp(`ADD TABLE public\\.${table}\\b`),
      )
    }
    assert.match(publicationSql, /ALTER TABLE public\.messages REPLICA IDENTITY FULL;/)
    assert.match(publicationSql, /ALTER TABLE public\.conversations REPLICA IDENTITY FULL;/)
    assert.match(publicationSql, /ALTER TABLE public\.live_chat_sessions REPLICA IDENTITY FULL;/)
  })
})
