import assert from "node:assert/strict"
import { register } from "node:module"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"

// createShopifyInstallUrl lives beside the Supabase server client import.
// Node's test runner cannot resolve next/headers, and this test never calls it.
register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/headers") {
    const stub = "export function cookies() { return { getAll() { return [] }, setAll() {} } }"
    return {
      url: "data:text/javascript," + encodeURIComponent(stub),
      shortCircuit: true,
    }
  }
  return nextResolve(specifier, context)
}
`),
)

const { completeShopifyOAuth, createShopifyInstallUrl, startShopifyOAuth } =
  await import("@/lib/services/shopifyOAuth")

const ENV_KEYS = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_TOKEN_ENCRYPTION_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
] as const

const snapshot = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = snapshot[key]
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }
}

function oauthStateSupabase(): SupabaseClient {
  const table = {
    delete() {
      return table
    },
    lt() {
      return Promise.resolve({ error: null })
    },
    insert() {
      return Promise.resolve({ error: null })
    },
  }
  return {
    from(name: string) {
      assert.equal(name, "shopify_oauth_states")
      return table
    },
  } as unknown as SupabaseClient
}

test.after(restoreEnv)

test("authorize URL requests the legacy install flow scopes", async () => {
  process.env.SHOPIFY_API_KEY = "shopify-client-id"
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.reswell.app"
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.VERCEL_URL

  const href = await createShopifyInstallUrl({
    serviceSupabase: oauthStateSupabase(),
    userId: "user-1",
    shopDomain: "reswell-pilot.myshopify.com",
  })

  const url = new URL(href)
  assert.equal(
    url.origin + url.pathname,
    "https://reswell-pilot.myshopify.com/admin/oauth/authorize",
  )
  assert.equal(
    url.searchParams.get("scope"),
    "read_products,write_products,read_inventory,write_inventory,read_locations,read_orders,write_orders",
  )
  assert.equal(url.searchParams.get("client_id"), "shopify-client-id")
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://www.reswell.app/api/integrations/shopify/callback",
  )
  assert.equal(typeof url.searchParams.get("state"), "string")
  assert.ok((url.searchParams.get("state") ?? "").length > 0)
  assert.deepEqual(
    [...url.searchParams.keys()].sort(),
    ["client_id", "redirect_uri", "scope", "state"],
  )
})

type QueryOp = {
  table: string
  op: "select" | "insert" | "update" | "upsert" | "delete"
  payload: unknown
  options: unknown
  filters: Array<{ column: string; value: unknown }>
}

function queryClient(
  handle: (op: QueryOp) => { data: unknown; error: { message: string } | null },
): SupabaseClient {
  return {
    from(table: string) {
      const query: QueryOp = {
        table,
        op: "select",
        payload: undefined,
        options: undefined,
        filters: [],
      }
      const finish = () =>
        handle({
          ...query,
          filters: query.filters.map((filter) => ({ ...filter })),
        })
      const builder: Record<string, unknown> = {
        select() {
          return builder
        },
        insert(payload: unknown) {
          query.op = "insert"
          query.payload = payload
          return builder
        },
        update(payload: unknown) {
          query.op = "update"
          query.payload = payload
          return builder
        },
        upsert(payload: unknown, options: unknown) {
          query.op = "upsert"
          query.payload = payload
          query.options = options
          return builder
        },
        delete() {
          query.op = "delete"
          return builder
        },
        eq(column: string, value: unknown) {
          query.filters.push({ column, value })
          return builder
        },
        in(column: string, value: unknown) {
          query.filters.push({ column, value })
          return builder
        },
        lt() {
          return builder
        },
        is() {
          return builder
        },
        gt() {
          return builder
        },
        neq() {
          return builder
        },
        or() {
          return builder
        },
        maybeSingle() {
          return Promise.resolve(finish())
        },
        single() {
          return Promise.resolve(finish())
        },
        then(
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(finish()).then(resolve, reject)
        },
      }
      return builder
    },
  } as unknown as SupabaseClient
}

function connectionRow(
  overrides: Partial<ShopifyConnectionRow> = {},
): ShopifyConnectionRow {
  return {
    id: "conn-1",
    user_id: "user-1",
    shop_domain: "old-store.myshopify.com",
    shop_gid: "gid://shopify/Shop/1",
    shop_name: "Old Store",
    status: "disconnected",
    sync_enabled: false,
    credential_provider: "public_oauth",
    active_credential_id: null,
    catalog_read_enabled: true,
    sales_enabled: true,
    inventory_write_enabled: true,
    source_of_truth: "shopify",
    billing_status: "pending",
    billing_subscription_gid: null,
    billing_line_item_gid: null,
    billing_capped_amount: null,
    billing_approved_at: null,
    access_token_ciphertext: "old-access",
    access_token_iv: "old-iv",
    access_token_tag: "old-tag",
    refresh_token_ciphertext: null,
    refresh_token_iv: null,
    refresh_token_tag: null,
    encryption_key_version: 1,
    token_expires_at: null,
    refresh_token_expires_at: null,
    token_refresh_locked_until: null,
    token_refresh_lock_id: null,
    scopes: ["read_products"],
    last_webhook_at: null,
    last_reconciled_at: null,
    last_error: null,
    connected_at: "2026-01-01T00:00:00.000Z",
    disconnected_at: "2026-02-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function startClient(input: {
  forUser: ShopifyConnectionRow | null
  forDomain: ShopifyConnectionRow | null
}): { client: SupabaseClient; ops: QueryOp[] } {
  const ops: QueryOp[] = []
  const client = queryClient((op) => {
    ops.push(op)
    if (op.table === "shopify_connections" && op.op === "select") {
      if (op.filters.some((filter) => filter.column === "user_id")) {
        return { data: input.forUser, error: null }
      }
      if (op.filters.some((filter) => filter.column === "shop_domain")) {
        return { data: input.forDomain, error: null }
      }
    }
    return { data: null, error: null }
  })
  return { client, ops }
}

function useAccountOAuthEnv() {
  process.env.SHOPIFY_API_KEY = "shopify-client-id"
  process.env.SHOPIFY_API_SECRET = "shopify-client-secret"
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "11".repeat(32)
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.reswell.app"
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.VERCEL_URL
}

function scenarioSupabase(input: {
  connections: ShopifyConnectionRow[]
  mappings?: Array<{ id: string; listing_id: string }>
  deadJobs?: Array<{ id: string; payload: Record<string, unknown> }>
}): {
  client: SupabaseClient
  connections: ShopifyConnectionRow[]
  ops: QueryOp[]
} {
  const connections = input.connections.map((row) => ({ ...row }))
  const ops: QueryOp[] = []
  const client = queryClient((op) => {
    ops.push(op)
    if (op.table === "shopify_connections" && op.op === "select") {
      const userId = op.filters.find((filter) => filter.column === "user_id")?.value
      const domain = op.filters.find((filter) => filter.column === "shop_domain")?.value
      const id = op.filters.find((filter) => filter.column === "id")?.value
      const match = connections.find((row) => {
        if (userId != null && row.user_id !== userId) return false
        if (domain != null && row.shop_domain !== domain) return false
        if (id != null && row.id !== id) return false
        return userId != null || domain != null || id != null
      })
      return { data: match ?? null, error: null }
    }
    if (op.table === "shopify_connections" && op.op === "upsert") {
      const payload = op.payload as Partial<ShopifyConnectionRow> & {
        user_id: string
      }
      const index = connections.findIndex((row) => row.user_id === payload.user_id)
      if (index >= 0) {
        connections[index] = { ...connections[index], ...payload }
        return { data: connections[index], error: null }
      }
      const created = connectionRow({ ...payload, id: "conn-new" })
      connections.push(created)
      return { data: created, error: null }
    }
    if (op.table === "shopify_credentials" && op.op === "insert") {
      return {
        data: { id: "cred-1", webhook_route_key: "route-1" },
        error: null,
      }
    }
    if (op.table === "shopify_product_mappings" && op.op === "select") {
      return { data: input.mappings ?? [], error: null }
    }
    if (op.table === "shopify_sync_jobs" && op.op === "select") {
      return { data: input.deadJobs ?? [], error: null }
    }
    return { data: null, error: null }
  })
  return { client, connections, ops }
}

function installShopifyFetch(): () => void {
  const original = globalThis.fetch
  const callback = "https://www.reswell.app/api/webhooks/shopify"
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input)
    if (url.includes("/admin/oauth/access_token")) {
      return Response.json({
        access_token: "shpat_test",
        refresh_token: "shprt_test",
        expires_in: 3600,
        refresh_token_expires_in: 86_400,
        scope: "read_products,read_inventory,write_inventory,read_locations",
      })
    }
    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string }
    const query = body.query ?? ""
    if (query.includes("ReswellShopIdentity")) {
      return Response.json({
        data: { shop: { id: "gid://shopify/Shop/99", name: "New Store" } },
      })
    }
    if (query.includes("ReswellWebhookSubscriptions")) {
      return Response.json({
        data: {
          webhookSubscriptions: {
            nodes: [
              "PRODUCTS_UPDATE",
              "PRODUCTS_DELETE",
              "INVENTORY_LEVELS_UPDATE",
              "APP_UNINSTALLED",
              "ORDERS_CREATE",
              "METAFIELDS_UPDATE",
            ].map((topic) => ({
              topic,
              endpoint: { callbackUrl: callback },
            })),
          },
        },
      })
    }
    throw new Error(`Unexpected Shopify request ${url}`)
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

test("a disconnected connection does not block OAuth for the same or another shop", async () => {
  useAccountOAuthEnv()
  for (const shopDomain of [
    "old-store.myshopify.com",
    "new-store.myshopify.com",
  ]) {
    const { client, ops } = startClient({
      forUser: connectionRow(),
      forDomain: null,
    })
    const href = await startShopifyOAuth({
      userId: "user-1",
      shopDomain,
      serviceSupabase: client,
    })
    assert.equal(new URL(href).host, shopDomain)
    assert.equal(
      ops.some(
        (op) => op.table === "shopify_oauth_states" && op.op === "insert",
      ),
      true,
    )
  }
})

test("a non-disconnected connection to another shop still requires disconnect", async () => {
  useAccountOAuthEnv()
  for (const status of ["active", "error", "reauthorization_required"] as const) {
    const { client, ops } = startClient({
      forUser: connectionRow({
        status,
        sync_enabled: status === "active",
        disconnected_at: null,
      }),
      forDomain: null,
    })
    await assert.rejects(
      () =>
        startShopifyOAuth({
          userId: "user-1",
          shopDomain: "new-store.myshopify.com",
          serviceSupabase: client,
        }),
      /different Shopify store/,
    )
    assert.equal(
      ops.some((op) => op.table === "shopify_oauth_states"),
      false,
    )
  }
})

test("an active shop link owned by another Reswell account stays blocked", async () => {
  useAccountOAuthEnv()
  const { client, ops } = startClient({
    forUser: connectionRow(),
    forDomain: connectionRow({
      id: "conn-2",
      user_id: "user-2",
      status: "active",
      sync_enabled: true,
      shop_domain: "new-store.myshopify.com",
      disconnected_at: null,
    }),
  })
  await assert.rejects(
    () =>
      startShopifyOAuth({
        userId: "user-1",
        shopDomain: "new-store.myshopify.com",
        serviceSupabase: client,
      }),
    /different Reswell account/,
  )
  assert.equal(
    ops.some((op) => op.table === "shopify_oauth_states" && op.op === "insert"),
    false,
  )
})

test("completing OAuth moves the existing row onto the new shop and leaves old listings unpublished", async () => {
  useAccountOAuthEnv()
  const restoreFetch = installShopifyFetch()
  try {
    const { client, connections, ops } = scenarioSupabase({
      connections: [connectionRow()],
      mappings: [{ id: "map-1", listing_id: "listing-1" }],
      deadJobs: [{ id: "job-1", payload: { locationId: "loc-1" } }],
    })
    const connection = await completeShopifyOAuth({
      serviceSupabase: client,
      userId: "user-1",
      shopDomain: "new-store.myshopify.com",
      code: "oauth-code",
    })

    assert.equal(connections.length, 1)
    assert.equal(connection.id, "conn-1")
    assert.equal(connections[0]?.shop_domain, "new-store.myshopify.com")
    assert.equal(connections[0]?.status, "active")
    const upserts = ops.filter(
      (op) => op.table === "shopify_connections" && op.op === "upsert",
    )
    assert.equal(upserts.length, 1)
    assert.deepEqual(upserts[0]?.options, { onConflict: "user_id" })
    assert.equal(
      ops.some((op) => op.table === "shopify_connections" && op.op === "insert"),
      false,
    )

    const listingUpdate = ops.find(
      (op) => op.table === "listings" && op.op === "update",
    )
    assert.equal(
      (listingUpdate?.payload as { status?: string } | undefined)?.status,
      "removed",
    )
    const mappingUpdate = ops.find(
      (op) => op.table === "shopify_product_mappings" && op.op === "update",
    )
    assert.equal(
      (mappingUpdate?.payload as { selected?: boolean } | undefined)?.selected,
      false,
    )
    const jobUpdates = ops.filter(
      (op) => op.table === "shopify_sync_jobs" && op.op === "update",
    )
    assert.equal(jobUpdates.length, 1)
    assert.equal(
      (jobUpdates[0]?.payload as { status?: string } | undefined)?.status,
      "canceled",
    )
    assert.equal(
      ops.some((op) => op.table === "shopify_sync_jobs" && op.op === "select"),
      false,
    )
  } finally {
    restoreFetch()
  }
})

test("reconnecting the same shop still retries dead inventory jobs", async () => {
  useAccountOAuthEnv()
  const restoreFetch = installShopifyFetch()
  try {
    const { client, connections, ops } = scenarioSupabase({
      connections: [connectionRow()],
      mappings: [{ id: "map-1", listing_id: "listing-1" }],
      deadJobs: [{ id: "job-1", payload: { locationId: "loc-1" } }],
    })
    const connection = await completeShopifyOAuth({
      serviceSupabase: client,
      userId: "user-1",
      shopDomain: "old-store.myshopify.com",
      code: "oauth-code",
    })
    assert.equal(connection.id, "conn-1")
    assert.equal(connections.length, 1)
    assert.equal(connections[0]?.shop_domain, "old-store.myshopify.com")
    assert.equal(
      ops.some((op) => op.table === "listings"),
      false,
    )
    const jobUpdates = ops.filter(
      (op) => op.table === "shopify_sync_jobs" && op.op === "update",
    )
    assert.equal(jobUpdates.length, 1)
    assert.equal(
      (jobUpdates[0]?.payload as { status?: string } | undefined)?.status,
      "queued",
    )
  } finally {
    restoreFetch()
  }
})

test("completing OAuth does not take a shop another account actively linked", async () => {
  const { client, connections, ops } = scenarioSupabase({
    connections: [
      connectionRow(),
      connectionRow({
        id: "conn-2",
        user_id: "user-2",
        status: "active",
        sync_enabled: true,
        shop_domain: "new-store.myshopify.com",
        disconnected_at: null,
      }),
    ],
  })
  await assert.rejects(
    () =>
      completeShopifyOAuth({
        serviceSupabase: client,
        userId: "user-1",
        shopDomain: "new-store.myshopify.com",
        code: "oauth-code",
      }),
    /different Reswell account/,
  )
  assert.equal(connections[0]?.shop_domain, "old-store.myshopify.com")
  assert.equal(connections[1]?.user_id, "user-2")
  assert.equal(
    ops.some((op) => op.op === "upsert"),
    false,
  )
})
