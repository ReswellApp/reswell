import type { SupabaseClient } from "@supabase/supabase-js"
import { trackKlaviyoSoldSaleFeedback } from "@/lib/klaviyo/track-sold-sale-feedback"
import type { SoldOffPlatformChannel } from "@/lib/validations/mark-listing-sold"

type ListingSaleFeedbackRow = {
  id: string
  user_id: string
  status: string
  title: string
  price: number
  section: string
  slug: string | null
  sold_off_platform_channel: string | null
  sold_off_platform_detail: string | null
  sold_reswell_helped_find_buyer: boolean | null
}

export type SaveListingSaleFeedbackResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

export async function saveListingSaleFeedback(
  supabase: SupabaseClient,
  params: {
    listingId: string
    sellerUserId: string
    sellerEmail?: string | null
    channel?: SoldOffPlatformChannel
    detail?: string | null
    reswellHelpedFindBuyer?: boolean
  },
): Promise<SaveListingSaleFeedbackResult> {
  const { listingId, sellerUserId, channel, detail, reswellHelpedFindBuyer } = params

  const { data, error: loadError } = await supabase
    .from("listings")
    .select(
      "id, user_id, status, title, price, section, slug, sold_off_platform_channel, sold_off_platform_detail, sold_reswell_helped_find_buyer",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (loadError || !data) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const row = data as ListingSaleFeedbackRow
  if (row.user_id !== sellerUserId) {
    return { ok: false, status: 403, error: "Forbidden" }
  }
  if (row.status !== "sold") {
    return { ok: false, status: 400, error: "Listing is not marked as sold" }
  }

  const patch: {
    sold_off_platform_channel?: SoldOffPlatformChannel
    sold_off_platform_detail?: string | null
    sold_reswell_helped_find_buyer?: boolean
    updated_at: string
  } = { updated_at: new Date().toISOString() }

  if (channel) {
    patch.sold_off_platform_channel = channel
    patch.sold_off_platform_detail = channel === "elsewhere" ? (detail?.trim() ?? "") : null
  }
  if (typeof reswellHelpedFindBuyer === "boolean") {
    patch.sold_reswell_helped_find_buyer = reswellHelpedFindBuyer
  }

  const { error } = await supabase
    .from("listings")
    .update(patch)
    .eq("id", listingId)
    .eq("user_id", sellerUserId)

  if (error) {
    return { ok: false, status: 500, error: "Failed to save sale details" }
  }

  const nextChannel = channel ?? (row.sold_off_platform_channel as SoldOffPlatformChannel | null)
  const nextDetail =
    channel === "elsewhere"
      ? (detail?.trim() ?? "")
      : channel
        ? null
        : row.sold_off_platform_detail
  const nextHelped =
    typeof reswellHelpedFindBuyer === "boolean"
      ? reswellHelpedFindBuyer
      : row.sold_reswell_helped_find_buyer

  void trackKlaviyoSoldSaleFeedback({
    sellerUserId,
    sellerEmail: params.sellerEmail,
    listingId,
    title: row.title,
    price: row.price,
    section: row.section,
    slug: row.slug,
    channel: nextChannel,
    channelDetail: nextDetail,
    reswellHelpedFindBuyer: nextHelped,
  })

  return { ok: true }
}
