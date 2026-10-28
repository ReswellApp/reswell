import {
  mobileBalanceSheetSchema,
  mobileShipperActionBodySchema,
  mobileShipperSchema,
  mobileShopifyActionBodySchema,
  mobileShopifySchema,
  mobileSupportCasesSchema,
  mobileSupportCreateResultSchema,
  mobileSupportMediaResultSchema,
  mobileSupportReplyResultSchema,
  mobileSupportThreadSchema,
  type MobileSupportMediaBody,
  type MobileSupportMediaResult,
  type MobileBalanceSheet,
  type MobileShipper,
  type MobileShipperActionBody,
  type MobileShipperActionResult,
  type MobileShopify,
  type MobileShopifyActionBody,
  type MobileShopifyActionResult,
  type MobileSupportCases,
  type MobileSupportReplyResult,
  type MobileSupportThread,
} from "@reswell/api-contract"
import { createSupportCaseWithOpeningMessage } from "@/lib/services/supportCaseOpen"
import { rejectIfMemberHasOpenSupportCase } from "@/lib/services/supportCaseOpenLimit"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { shipperJobActions, supportStatusLabel } from "@/lib/services/mobileDashboardSectionMap"
import {
  getCoastalShipperDashboard,
  setCoastalShipperDashboardJobStatus,
  setCoastalShipperDashboardSchedule,
} from "@/lib/services/coastalShipperDashboard"
import { getSellerBalanceSheetPage } from "@/lib/db/sellerBalanceSheet"
import { isPeerListingSection, PEER_LISTING_SECTION_LABELS, PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"
import { checkShopifyMerchantAccess } from "@/lib/services/shopifyAccess"
import {
  getShopifyConnectionStatus,
  listMerchantShopifyProducts,
  selectMerchantShopifyProduct,
  unpublishMerchantShopifyProduct,
} from "@/lib/services/shopifyConnection"
import { latestAgentReplyPreviewsByCaseIds } from "@/lib/db/supportCases"
import { listUserSupportCasesForClient } from "@/lib/services/supportCases"
import { humanizeSupportCasePreview } from "@/lib/utils/humanize-support-case-preview"
import {
  getSupportCaseThreadForMember,
  sendSupportCaseMemberReplyForSession,
} from "@/lib/services/supportCaseThread"
import { sendSupportCaseMediaMessage } from "@/lib/services/sendSupportCaseMediaMessage"
import { parseSupportCaseMessageImageAttachment } from "@/lib/validations/support-case-attachment"
import type { CoastalDeliveryStatus } from "@/lib/types/coastal-delivery"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import type { SupabaseClient, User } from "@supabase/supabase-js"

const UNAVAILABLE = "This page is not available for your account."
const SHIPPER_STATUS_LABEL: Record<CoastalDeliveryStatus, string> = {
  waiting_for_run: "Waiting for run",
  picked_up: "Picked up",
  dropped_off: "Dropped off",
  cancelled: "Cancelled",
}

function money(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

export async function listMobileSupportCasesService(
  supabase: SupabaseClient,
  user: User,
): Promise<MobileApiResult<MobileSupportCases>> {
  const cases = await listUserSupportCasesForClient(supabase, user.id, user.email ?? null, "all")
  const agentBodies = await latestAgentReplyPreviewsByCaseIds(
    supabase,
    cases.map((row) => row.id),
  )
  const parsed = mobileSupportCasesSchema.safeParse({
    cases: cases.map((row) => {
      const agentBody = agentBodies.get(row.id)
      const teamReplyPreview = agentBody ? humanizeSupportCasePreview(agentBody, 140) : null
      return {
        id: row.id,
        status: row.status,
        status_label: supportStatusLabel(row.status),
        subject: row.subject,
        preview: row.preview,
        team_reply_preview: teamReplyPreview && teamReplyPreview.length > 0 ? teamReplyPreview : null,
        order_ref: row.orderRef,
        updated_at: row.updatedAt,
        unread_count: row.unreadCount,
        closed: row.status === "resolved",
      }
    }),
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load help right now" }
  return { ok: true, data: parsed.data }
}

export async function openMobileSupportCaseService(
  _supabase: SupabaseClient,
  user: User,
  input: { subject: string; body: string },
): Promise<MobileApiResult<{ id: string }>> {
  const openGate = await rejectIfMemberHasOpenSupportCase(user.id)
  if (!openGate.ok) {
    return { ok: false, status: 409, error: openGate.error }
  }

  const email = (user.email ?? "").trim()
  if (!email) {
    return { ok: false, status: 400, error: "Your account needs an email address before you can start a help thread." }
  }

  // Members can SELECT own rows via RLS; inserts are server-side (same as Help Hub / Messages support).
  const service = createServiceRoleClient()
  const opened = await createSupportCaseWithOpeningMessage(service, {
    kind: "general",
    subject: input.subject,
    preview: input.body.slice(0, 180),
    body: input.body,
    requester_user_id: user.id,
    requester_email: email,
    requester_role: "member",
    authorUserId: user.id,
    source_channel: "mobile",
    opened_by: "requester",
  })
  if (!opened) return { ok: false, status: 500, error: "Unable to start a help thread right now" }
  const parsed = mobileSupportCreateResultSchema.safeParse({ id: opened.id })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to start a help thread right now" }
  return { ok: true, data: parsed.data }
}

export async function getMobileSupportThreadService(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
): Promise<MobileApiResult<MobileSupportThread>> {
  const thread = await getSupportCaseThreadForMember(userId, caseId, supabase)
  if ("error" in thread) return { ok: false, status: 404, error: "Help thread not found" }
  const parsed = mobileSupportThreadSchema.safeParse({
    id: thread.case.id,
    subject: thread.case.subject,
    status_label: supportStatusLabel(thread.case.status),
    closed: thread.case.status === "resolved",
    messages: thread.messages
      .filter((message) => !message.is_internal)
      .map((message) => {
        const image = parseSupportCaseMessageImageAttachment(message.metadata)
        return {
          id: message.id,
          body: message.body,
          created_at: message.created_at,
          mine: message.author_user_id === userId,
          author_role: message.author_role,
          attachment: image ? { kind: "image" as const } : undefined,
        }
      }),
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load this help thread right now" }
  return { ok: true, data: parsed.data }
}

export async function replyMobileSupportCaseService(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
  body: string,
): Promise<MobileApiResult<MobileSupportReplyResult>> {
  const sent = await sendSupportCaseMemberReplyForSession(supabase, userId, caseId, body)
  if ("error" in sent) {
    const missing = sent.error === "Case not found."
    return { ok: false, status: missing ? 404 : 400, error: sent.error }
  }
  const parsed = mobileSupportReplyResultSchema.safeParse({ case_id: sent.case_id })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to send your message right now" }
  return { ok: true, data: parsed.data }
}

export async function sendMobileSupportMediaMessage(
  user: User,
  caseId: string,
  input: MobileSupportMediaBody,
): Promise<MobileApiResult<MobileSupportMediaResult>> {
  const result = await sendSupportCaseMediaMessage({
    caseId,
    senderId: user.id,
    attachment: input.attachment,
    caption: input.caption,
  })
  if (!result.ok) {
    const missing = result.error === "Case not found."
    return { ok: false, status: missing ? 404 : (result.status ?? 400), error: result.error }
  }
  const parsed = mobileSupportMediaResultSchema.safeParse(result.message)
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to send that photo right now" }
  return { ok: true, data: parsed.data }
}

export async function getMobileShipperService(
  supabase: SupabaseClient,
): Promise<MobileApiResult<MobileShipper>> {
  const loaded = await getCoastalShipperDashboard({ shipperId: null, session: supabase })
  if (!loaded.ok) {
    if (loaded.code === "not_found") return { ok: false, status: 404, error: UNAVAILABLE }
    return { ok: false, status: 500, error: loaded.error }
  }
  const data = loaded.data
  const jobs = data.sections.flatMap((section) => section.jobs)
  const parsed = mobileShipperSchema.safeParse({
    shipper_id: data.shipperId,
    display_name: data.displayName,
    week_label: data.weekLabel,
    schedule_enabled: data.scheduleEnabled,
    price_label: money(data.priceCents / 100),
    job_count: data.jobCount,
    run_count: data.sections.filter((section) => section.runId && section.enabled).length,
    jobs: jobs.map((job) => ({
      id: job.id,
      listing_title: job.listingTitle,
      sale_label: job.saleLabel,
      status: job.status,
      status_label: SHIPPER_STATUS_LABEL[job.status],
      pickup_label: job.pickupLabel,
      dropoff_label: job.dropoffLabel,
      next_handoff: job.nextHandoff,
      actions: shipperJobActions(job.status, job.statusActionsEnabled),
    })),
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load Shipper right now" }
  return { ok: true, data: parsed.data }
}

export async function actOnMobileShipperService(
  supabase: SupabaseClient,
  body: MobileShipperActionBody,
): Promise<MobileApiResult<MobileShipperActionResult>> {
  const parsedBody = mobileShipperActionBodySchema.safeParse(body)
  if (!parsedBody.success) {
    return { ok: false, status: 400, error: parsedBody.error.issues[0]?.message ?? "Invalid Shipper update" }
  }
  const current = await getCoastalShipperDashboard({ shipperId: null, session: supabase })
  if (!current.ok) {
    if (current.code === "not_found") return { ok: false, status: 404, error: UNAVAILABLE }
    return { ok: false, status: 500, error: current.error }
  }
  if (parsedBody.data.action === "schedule") {
    const saved = await setCoastalShipperDashboardSchedule({
      shipperId: current.data.shipperId,
      enabled: parsedBody.data.enabled === true,
      session: supabase,
    })
    if (!saved.ok) return { ok: false, status: 400, error: saved.error }
    return { ok: true, data: { updated: true } }
  }
  const saved = await setCoastalShipperDashboardJobStatus({
    shipperId: current.data.shipperId,
    requestId: parsedBody.data.job_id ?? "",
    status: parsedBody.data.status ?? "waiting_for_run",
    session: supabase,
  })
  if (!saved.ok) return { ok: false, status: 400, error: saved.error }
  return { ok: true, data: { updated: true } }
}

export async function getMobileBalanceSheetService(
  supabase: SupabaseClient,
  userId: string,
  page: number,
): Promise<MobileApiResult<MobileBalanceSheet>> {
  const { data: profile, error } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle()
  if (error) return { ok: false, status: 500, error: "Unable to load the balance sheet right now" }
  if (profile?.is_admin !== true) return { ok: false, status: 404, error: UNAVAILABLE }

  let sheet
  try {
    sheet = await getSellerBalanceSheetPage(supabase, userId, page, 50, null, "recent")
  } catch (cause) {
    console.error("[mobile-api] balance sheet failed", {
      userId,
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return { ok: false, status: 500, error: "Unable to load the balance sheet right now" }
  }

  const summary = sheet.summary
  const parsed = mobileBalanceSheetSchema.safeParse({
    inventory_listings: summary.inventoryListings,
    inventory_asking_label: money(summary.inventoryAskingValue),
    inventory_cost_label: money(summary.inventoryCostBasis),
    realized_sales: summary.realizedSales,
    gross_sales_label: money(summary.grossSales),
    fees_label: money(summary.reswellFees),
    realized_profit_label: money(summary.realizedProfit),
    missing_cost_basis: summary.missingCostBasis,
    page: sheet.page,
    total_pages: sheet.totalPages,
    entries: sheet.entries.map((entry) => ({
      id: entry.entryKey,
      listing_id: entry.listingId,
      title: entry.listingTitle,
      section_label: isPeerListingSection(entry.listingSection)
        ? PEER_LISTING_SECTION_LABELS[entry.listingSection]
        : entry.listingSection,
      sold_label: money(entry.soldPrice),
      profit_label: entry.profit == null ? null : money(entry.profit),
      sold_at: entry.soldAt,
      order_number: entry.orderNum,
    })),
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load the balance sheet right now" }
  return { ok: true, data: parsed.data }
}

export async function getMobileShopifyService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileShopify>> {
  const access = await checkShopifyMerchantAccess(supabase, userId)
  const sections = PEER_LISTING_SECTIONS.map((id) => ({ id, label: PEER_LISTING_SECTION_LABELS[id] }))
  if (!access.allowed) {
    const parsed = mobileShopifySchema.safeParse({
      shop_name: null,
      shop_domain: null,
      connected: false,
      sync_enabled: false,
      status_label: "Unavailable",
      message: access.message,
      products: [],
      sections,
    })
    if (!parsed.success) return { ok: false, status: 500, error: "Unable to load Shopify right now" }
    return { ok: true, data: parsed.data }
  }

  const status = await getShopifyConnectionStatus(userId)
  if (!status.ok) return { ok: false, status: status.status, error: status.error }
  const connection = status.data
  const active = connection?.status === "active" && connection.sync_enabled === true
  let products: MobileShopify["products"] = []
  let message: string | null = connection ? null : "Connect Shopify on the website, then products show up here."
  if (active) {
    const listed = await listMerchantShopifyProducts({ userId })
    if (!listed.ok) {
      message = listed.error
    } else {
      products = listed.data.products.map((product) => {
        const price = product.variants[0]?.price
        return {
          id: product.id,
          title: product.title,
          image_url: product.imageUrl,
          price_label: typeof price === "number" ? money(price) : null,
          selected: product.selected,
          section_label: product.selectedSection ? PEER_LISTING_SECTION_LABELS[product.selectedSection] : null,
        }
      })
    }
  } else if (connection) {
    message = "Reconnect Shopify to load products."
  }

  const parsed = mobileShopifySchema.safeParse({
    shop_name: connection?.shop_name ?? null,
    shop_domain: connection?.shop_domain ?? null,
    connected: Boolean(connection),
    sync_enabled: connection?.sync_enabled === true,
    status_label: active ? "Connected" : connection ? "Needs reconnect" : "Not connected",
    message,
    products,
    sections,
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load Shopify right now" }
  return { ok: true, data: parsed.data }
}

export async function actOnMobileShopifyService(
  supabase: SupabaseClient,
  userId: string,
  body: MobileShopifyActionBody,
): Promise<MobileApiResult<MobileShopifyActionResult>> {
  const parsedBody = mobileShopifyActionBodySchema.safeParse(body)
  if (!parsedBody.success) {
    return { ok: false, status: 400, error: parsedBody.error.issues[0]?.message ?? "Invalid Shopify update" }
  }
  const access = await checkShopifyMerchantAccess(supabase, userId)
  if (!access.allowed) return { ok: false, status: 403, error: access.message }

  if (parsedBody.data.action === "unpublish") {
    const removed = await unpublishMerchantShopifyProduct({ userId, productId: parsedBody.data.product_id })
    if (!removed.ok) return { ok: false, status: removed.status, error: removed.error }
    return { ok: true, data: { product_id: parsedBody.data.product_id, selected: false } }
  }

  if (!parsedBody.data.section || !isPeerListingSection(parsedBody.data.section)) {
    return { ok: false, status: 400, error: "Choose a category before publishing." }
  }
  const published = await selectMerchantShopifyProduct({
    userId,
    productId: parsedBody.data.product_id,
    section: parsedBody.data.section,
  })
  if (!published.ok) return { ok: false, status: published.status, error: published.error }
  return { ok: true, data: { product_id: parsedBody.data.product_id, selected: true } }
}
