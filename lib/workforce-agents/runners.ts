import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  WorkforceAgentId,
  WorkforceRunResult,
} from "@/lib/workforce-agents/types"

type Runner = (supabase: SupabaseClient) => Promise<WorkforceRunResult>

function ok(summary: string, detail: Record<string, unknown> = {}): WorkforceRunResult {
  return { status: "ok", summary, detail }
}

function err(summary: string, detail: Record<string, unknown> = {}): WorkforceRunResult {
  return { status: "error", summary, detail }
}

async function runShopScout(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const [{ count: shopProfiles }, { data: crmLeads, error: crmError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_shop", true),
    supabase
      .from("crm_contacts")
      .select("id, first_name, last_name, email, status, priority, next_follow_up_at, notes")
      .in("status", ["lead", "prospect"])
      .order("priority", { ascending: false })
      .limit(25),
  ])

  if (crmError) return err(`CRM scout failed: ${crmError.message}`)

  const shopish = (crmLeads ?? []).filter((row) => {
    const hay = `${row.first_name ?? ""} ${row.last_name ?? ""} ${row.notes ?? ""}`.toLowerCase()
    return hay.includes("shop") || hay.includes("surf") || Boolean(row.email)
  })

  return ok(
    `Scouted ${shopProfiles ?? 0} shop profiles and ${shopish.length} CRM leads ready for outreach.`,
    {
      shopProfileCount: shopProfiles ?? 0,
      crmLeadCount: (crmLeads ?? []).length,
      topLeads: shopish.slice(0, 10).map((row) => ({
        id: row.id,
        name: [row.first_name, row.last_name].filter(Boolean).join(" "),
        email: row.email,
        status: row.status,
        priority: row.priority,
        nextFollowUpAt: row.next_follow_up_at,
      })),
      nextStep: "Turn on Shop Mailer to draft intros for these leads.",
    },
  )
}

async function runShopMailer(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("id, first_name, last_name, email, status, next_follow_up_at, notes")
    .not("email", "is", null)
    .in("status", ["lead", "prospect", "active"])
    .or(`next_follow_up_at.is.null,next_follow_up_at.lte.${nowIso}`)
    .order("next_follow_up_at", { ascending: true, nullsFirst: true })
    .limit(15)

  if (error) return err(`Mailer queue failed: ${error.message}`)

  const drafts = (data ?? []).map((row) => {
    const name = row.first_name?.trim() || "there"
    const shopHint = row.notes?.includes("shop") ? "your shop" : "your used boards"
    return {
      contactId: row.id,
      to: row.email,
      subject: "List trade-ins on Reswell — free until they sell",
      body: [
        `Hi ${name},`,
        "",
        `I'm Hayden from Reswell — the used surfboard marketplace. Shops list trade-ins, demos, and used rack boards for free and keep 93% when a board sells.`,
        "",
        `If ${shopHint} could use more buyer reach (pickup at the shop or shipping), I can get you set up in a few minutes: reswell.com/for-surf-shops`,
        "",
        "Happy to answer anything — just reply here.",
        "",
        "— Hayden",
      ].join("\n"),
      nextFollowUpAt: row.next_follow_up_at,
    }
  })

  return ok(`Drafted ${drafts.length} shop outreach emails (not sent — review in Gmail / CRM).`, {
    drafts,
    note: "Wire Shop Mailer to Gmail MCP / Agent SDK for auto-draft into your inbox when ready.",
  })
}

async function runFbSupplyCopilot(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const { data, error } = await supabase
    .from("crm_contacts")
    .select(
      "id, first_name, last_name, facebook_display_name, facebook_thread_url, facebook_profile_url, status, priority, next_follow_up_at, notes",
    )
    .or(
      "facebook_thread_url.not.is.null,facebook_profile_url.not.is.null,facebook_display_name.not.is.null",
    )
    .order("updated_at", { ascending: false })
    .limit(20)

  if (error) return err(`FB copilot failed: ${error.message}`)

  const leads = (data ?? []).map((row) => ({
    id: row.id,
    name:
      row.facebook_display_name ||
      [row.first_name, row.last_name].filter(Boolean).join(" ") ||
      "FB lead",
    threadUrl: row.facebook_thread_url,
    profileUrl: row.facebook_profile_url,
    status: row.status,
    priority: row.priority,
    draftReply:
      "Hey — saw your board on Marketplace. If you want a wider buyer pool with Purchase Protection, you can list it on Reswell too (free to post). Happy to help if useful.",
  }))

  return ok(
    `Prepared ${leads.length} FB Marketplace assist drafts. Send manually — no auto-DM.`,
    {
      leads,
      policy: "Meta ToS: assist-only. Human sends Marketplace messages.",
    },
  )
}

async function runMetaAdsWriter(): Promise<WorkforceRunResult> {
  const monthLabel = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  })

  const pack = {
    month: monthLabel,
    primaryTexts: [
      "Buy used surfboards with Purchase Protection. Sell for free until it sells — keep 93%.",
      "Skip the Facebook flaking. Reswell is the used surfboard marketplace built for real checkout.",
      "Trade-ins and used racks: surf shops list free on Reswell. Buyers pick up or ship.",
    ],
    headlines: [
      "Used boards. Real checkout.",
      "Sell free until it sells",
      "Shop used, surf more",
    ],
    descriptions: [
      "Browse used surfboards near you.",
      "Free to list. 93% to the seller.",
      "Pickup or shipping on Reswell.",
    ],
    cta: "Shop now / Learn more",
    landingUrls: ["https://reswell.com/boards", "https://reswell.com/for-surf-shops"],
  }

  return ok(`Meta ad copy pack ready for ${monthLabel} (create paused in Ads Manager).`, {
    pack,
  })
}

async function runListingCompleter(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, user_id, price, updated_at, status")
    .eq("status", "draft")
    .lt("updated_at", twoHoursAgo)
    .order("updated_at", { ascending: false })
    .limit(25)

  if (error) return err(`Listing completer failed: ${error.message}`)

  const drafts = data ?? []
  const missingPrice = drafts.filter((row) => row.price == null).length

  return ok(
    `Found ${drafts.length} stale draft listings (${missingPrice} missing price).`,
    {
      drafts: drafts.map((row) => ({
        id: row.id,
        title: row.title,
        userId: row.user_id,
        price: row.price,
        updatedAt: row.updated_at,
      })),
      tip: "Klaviyo unfinished-listing cron still sends nudges; this agent prioritizes the ops queue.",
    },
  )
}

async function runSellerReactivator(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
  const { data: pastSellers, error: pastError } = await supabase
    .from("listings")
    .select("user_id, updated_at")
    .in("status", ["sold", "removed", "active"])
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (pastError) return err(`Seller reactivator failed: ${pastError.message}`)

  const uniquePast: { userId: string; lastSeen: string }[] = []
  const seen = new Set<string>()
  for (const row of pastSellers ?? []) {
    if (!row.user_id || seen.has(row.user_id)) continue
    seen.add(row.user_id)
    uniquePast.push({ userId: row.user_id, lastSeen: row.updated_at })
  }

  const candidateIds = uniquePast.map((row) => row.userId)
  let activeRecently = new Set<string>()
  if (candidateIds.length > 0) {
    const { data: recentSellers, error } = await supabase
      .from("listings")
      .select("user_id")
      .eq("status", "active")
      .gt("updated_at", cutoff)
      .in("user_id", candidateIds)

    if (error) return err(`Seller reactivator failed: ${error.message}`)
    activeRecently = new Set((recentSellers ?? []).map((row) => row.user_id))
  }

  const candidates = uniquePast
    .filter((row) => !activeRecently.has(row.userId))
    .slice(0, 20)

  return ok(`Ranked ${candidates.length} sellers to reactivate (quiet 45+ days).`, {
    candidates,
  })
}

async function runShopifyShopCloser(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const { data: shops, error } = await supabase
    .from("profiles")
    .select("id, shop_name, display_name, email, is_shop")
    .eq("is_shop", true)
    .limit(200)

  if (error) return err(`Shopify closer failed: ${error.message}`)

  const shopIds = (shops ?? []).map((row) => row.id)
  if (shopIds.length === 0) {
    return ok("No shop profiles found yet.", { candidates: [] })
  }

  const { data: connected, error: shopifyError } = await supabase
    .from("shopify_connections")
    .select("user_id, shop_domain")
    .in("user_id", shopIds)
    .neq("status", "disconnected")

  if (shopifyError) {
    return ok(
      `Found ${shops?.length ?? 0} shop profiles. Could not join Shopify connections (${shopifyError.message}).`,
      {
        shops: (shops ?? []).slice(0, 20).map((row) => ({
          id: row.id,
          name: row.shop_name || row.display_name,
          email: row.email,
        })),
      },
    )
  }

  const connectedIds = new Set((connected ?? []).map((row) => row.user_id))
  const candidates = (shops ?? [])
    .filter((row) => !connectedIds.has(row.id))
    .slice(0, 25)
    .map((row) => ({
      id: row.id,
      name: row.shop_name || row.display_name,
      email: row.email,
      pitch:
        "Connect Shopify to sync inventory into Reswell — buyers check out with Purchase Protection while you keep shop ops in Shopify.",
    }))

  return ok(`Found ${candidates.length} shops without Shopify connected.`, { candidates })
}

async function runPriceGuideOps(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, brand, model, price, status, created_at")
    .eq("status", "active")
    .not("price", "is", null)
    .order("created_at", { ascending: false })
    .limit(40)

  if (error) return err(`Price guide ops failed: ${error.message}`)

  const listings = data ?? []
  const prices = listings
    .map((row) => Number(row.price))
    .filter((n) => Number.isFinite(n) && n > 0)
  const median =
    prices.length === 0
      ? null
      : [...prices].sort((a, b) => a - b)[Math.floor(prices.length / 2)]

  const outliers =
    median == null
      ? []
      : listings
          .filter((row) => {
            const p = Number(row.price)
            return Number.isFinite(p) && (p > median * 2.5 || p < median * 0.35)
          })
          .slice(0, 15)
          .map((row) => ({
            id: row.id,
            title: row.title,
            brand: row.brand,
            model: row.model,
            price: row.price,
            note:
              Number(row.price) > (median ?? 0)
                ? "Possibly overpriced vs recent sample"
                : "Possibly underpriced vs recent sample",
          }))

  return ok(
    `Reviewed ${listings.length} recent live listings; flagged ${outliers.length} price outliers.`,
    { medianSamplePrice: median, outliers },
  )
}

async function runBuyerMatchmaker(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [{ count: newListings }, { count: savedSearches }, { count: favorites }] =
    await Promise.all([
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gte("created_at", since),
      supabase.from("saved_searches").select("id", { count: "exact", head: true }),
      supabase.from("favorites").select("id", { count: "exact", head: true }),
    ])

  return ok(
    `Last 24h: ${newListings ?? 0} new live listings to match against ${savedSearches ?? 0} saved searches and ${favorites ?? 0} favorites.`,
    {
      newListings: newListings ?? 0,
      savedSearches: savedSearches ?? 0,
      favorites: favorites ?? 0,
      note: "Favorites digest cron already emails watchers; this agent tracks match volume for ops.",
    },
  )
}

async function runCsEscalation(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("support_cases")
    .select("id, subject, status, updated_at, created_at")
    .in("status", ["submitted", "in_review", "in_progress", "waiting_on_you"])
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(20)

  if (error) return err(`CS escalation failed: ${error.message}`)

  return ok(`Found ${(data ?? []).length} support cases quiet for 24h+.`, {
    cases: data ?? [],
  })
}

async function runContentSeo(): Promise<WorkforceRunResult> {
  const ideas = [
    {
      title: "How surf shops move trade-ins faster with Reswell",
      keyword: "surf shop trade-ins",
      outline: ["Pain of dead rack inventory", "Free listing + 93% payout", "Pickup vs shipping", "CTA /for-surf-shops"],
    },
    {
      title: "Used surfboard price guide: what sold last month",
      keyword: "used surfboard prices",
      outline: ["Top sold models", "Condition bands", "Link into price guide", "CTA /boards"],
    },
    {
      title: "Facebook Marketplace vs Reswell for selling a board",
      keyword: "sell used surfboard",
      outline: ["Flakes and no escrow", "Purchase Protection", "Fees comparison", "CTA /sell"],
    },
  ]

  return ok(`Proposed ${ideas.length} SEO content briefs for this week.`, { ideas })
}

async function runTrustFraud(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("fraud_messages")
    .select("id, created_at, reason_code, llm_review_status, content")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(25)

  if (error) {
    return ok(`Fraud messages unavailable (${error.message}).`, { warning: error.message })
  }

  const pending = (data ?? []).filter((row) => row.llm_review_status === "pending")
  return ok(
    `Last 7 days: ${(data ?? []).length} fraud flags · ${pending.length} still pending review.`,
    {
      reviews: (data ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        reasonCode: row.reason_code,
        status: row.llm_review_status,
        snippet:
          typeof row.content === "string" ? row.content.slice(0, 120) : null,
      })),
      pendingCount: pending.length,
    },
  )
}

async function runWeeklyPnl(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [{ count: orders }, { data: soldRows, error: soldError }, { count: newListings }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("listings")
        .select("id, price, last_sold_at, updated_at, status")
        .eq("status", "sold")
        .gte("updated_at", since)
        .limit(500),
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
    ])

  if (soldError) {
    return ok(
      `Weekly pulse: ${orders ?? 0} orders, ${newListings ?? 0} new listings (sold GMS unavailable: ${soldError.message}).`,
      {
        orders: orders ?? 0,
        newListings: newListings ?? 0,
      },
    )
  }

  const gms = (soldRows ?? []).reduce((sum, row) => sum + (Number(row.price) || 0), 0)
  const takeRate = 0.07
  const estimatedPlatform = gms * takeRate

  return ok(
    `Last 7 days: ~$${Math.round(gms).toLocaleString()} sold GMS · ~$${Math.round(estimatedPlatform).toLocaleString()} platform @7% · ${orders ?? 0} orders · ${newListings ?? 0} new listings.`,
    {
      gms,
      estimatedPlatformRevenue: estimatedPlatform,
      soldCount: soldRows?.length ?? 0,
      orders: orders ?? 0,
      newListings: newListings ?? 0,
      windowDays: 7,
    },
  )
}

async function runLocalDropoff(supabase: SupabaseClient): Promise<WorkforceRunResult> {
  const [{ data: locations, error: locError }, { count: dropoffListings }] = await Promise.all([
    supabase
      .from("dropoff_locations")
      .select("id, name, slug, active, city, state")
      .order("name"),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .not("dropoff_location_id", "is", null),
  ])

  if (locError) return err(`Drop-off ops failed: ${locError.message}`)

  const active = (locations ?? []).filter((row) => row.active !== false)

  return ok(
    `${active.length} active drop-off locations · ${dropoffListings ?? 0} live listings on drop-off.`,
    {
      locations: active,
      dropoffListingCount: dropoffListings ?? 0,
    },
  )
}

export const WORKFORCE_AGENT_RUNNERS: Record<WorkforceAgentId, Runner> = {
  "shop-scout": runShopScout,
  "shop-mailer": runShopMailer,
  "fb-supply-copilot": runFbSupplyCopilot,
  "meta-ads-writer": runMetaAdsWriter,
  "listing-completer": runListingCompleter,
  "seller-reactivator": runSellerReactivator,
  "shopify-shop-closer": runShopifyShopCloser,
  "price-guide-ops": runPriceGuideOps,
  "buyer-matchmaker": runBuyerMatchmaker,
  "cs-escalation": runCsEscalation,
  "content-seo": runContentSeo,
  "trust-fraud": runTrustFraud,
  "weekly-pnl": runWeeklyPnl,
  "local-dropoff": runLocalDropoff,
}
