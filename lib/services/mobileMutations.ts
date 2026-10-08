import { revalidatePath } from "next/cache"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import type {
  MobileCartResult,
  MobileFavoriteResult,
  MobileFollowResult,
  MobileMessageResult,
  MobileOfferActionBody,
  MobileOfferActionResult,
} from "@reswell/api-contract"
import { revalidateSellerProfileAndDirectoryCatalog } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { revalidateMessagesInboxForParticipants } from "@/lib/cache/revalidate-messages-inbox"
import {
  ensureConversationForBuyerSellerListing,
  getConversationForBuyerSellerListing,
} from "@/lib/db/conversations"
import {
  fetchListingForKlaviyoFavoriteEvent,
  isFavoriteListingEligibleForKlaviyoCommerce,
} from "@/lib/db/favoritesKlaviyo"
import { getListingRowForFavoriteNotification } from "@/lib/db/listings"
import { trackKlaviyoAddedToCart } from "@/lib/klaviyo/track-added-to-cart"
import { trackKlaviyoFavoritesButton } from "@/lib/klaviyo/track-favorites-button"
import { trackKlaviyoListingSaved } from "@/lib/klaviyo/track-listing-saved"
import { trackKlaviyoMessageSent } from "@/lib/klaviyo/track-message-sent"
import { messagePolicyBlocksDelivery } from "@/lib/messages/fraud-reason-codes"
import { evaluateMessagePolicyForSend } from "@/lib/messages/message-policy-enforcement"
import { captureServerEvent } from "@/lib/posthog-server"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { evaluateUserMessageSend } from "@/lib/services/accountRestrictions"
import { captureBlockedFraudMessage } from "@/lib/services/captureBlockedFraudMessage"
import { assertListingEligibleForCart, peerSurfboardAddCapError } from "@/lib/services/cartEligibility"
import { notifyShopFollowKlaviyo } from "@/lib/services/notifyShopFollowKlaviyo"
import { respondToCounterOfferService } from "@/lib/services/respondToCounterOffer"
import { respondToOfferService } from "@/lib/services/respondToOffer"
import { withdrawListingOffer } from "@/lib/services/withdrawListingOffer"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { MobileApiResult } from "@/lib/services/mobileApi"

function failure(status: number, error: string): MobileApiResult<never> {
  return { ok: false, status, error }
}

export async function setMobileFavorite(
  supabase: SupabaseClient,
  user: User,
  listingId: string,
  favorited: boolean,
): Promise<MobileApiResult<MobileFavoriteResult>> {
  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle()

  if (!favorited) {
    if (existing) {
      const { error } = await supabase.from("favorites").delete().eq("id", existing.id).eq("user_id", user.id)
      if (error) return failure(500, "Could not update this favorite.")
    }
    return { ok: true, data: { favorited: false } }
  }

  if (existing) return { ok: true, data: { favorited: true } }

  const { data: inserted, error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, listing_id: listingId })
    .select("id, created_at")
    .single()
  if (error || !inserted) return failure(500, "Could not save this listing.")

  const listing = await getListingRowForFavoriteNotification(supabase, listingId)
  if (listing && listing.user_id !== user.id) {
    const { data: favoriterProfile } = await supabase
      .from("profiles")
      .select("display_name, shop_name, is_shop")
      .eq("id", user.id)
      .maybeSingle()
    void trackKlaviyoFavoritesButton({
      listingOwnerId: listing.user_id,
      listingId,
      listingTitle: listing.title,
      listingSlug: listing.slug,
      listingSection: listing.section,
      favoriterUserId: user.id,
      favoriterEmail: user.email?.trim() ?? null,
      favoriterProfile,
      favoriteId: inserted.id,
      favoritedAt: inserted.created_at,
    })
    void fetchListingForKlaviyoFavoriteEvent(supabase, listingId).then((listingRow) => {
      if (!listingRow || !isFavoriteListingEligibleForKlaviyoCommerce(listingRow)) return
      void trackKlaviyoListingSaved({
        buyerUserId: user.id,
        buyerEmail: user.email?.trim() ?? null,
        favoriteId: inserted.id,
        favoritedAt: inserted.created_at,
        listing: listingRow,
      })
    })
  }

  return { ok: true, data: { favorited: true } }
}

export async function setMobileFollow(
  supabase: SupabaseClient,
  user: User,
  sellerId: string,
  following: boolean,
): Promise<MobileApiResult<MobileFollowResult>> {
  if (user.id === sellerId) return failure(400, "You can't follow yourself.")

  const { data: seller, error: sellerErr } = await supabase
    .from("profiles")
    .select("id, follower_count")
    .eq("id", sellerId)
    .maybeSingle()
  if (sellerErr || !seller) return failure(404, "Seller not found.")

  if (!following) {
    const { error } = await supabase
      .from("seller_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("seller_id", sellerId)
    if (error) return failure(500, "Could not unfollow this seller.")
  } else {
    const { data: existing } = await supabase
      .from("seller_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("seller_id", sellerId)
      .maybeSingle()
    if (!existing) {
      const { data: inserted, error } = await supabase
        .from("seller_follows")
        .insert({ follower_id: user.id, seller_id: sellerId })
        .select("id, created_at")
        .single()
      if (error || !inserted) return failure(500, "Could not follow this seller.")
      void notifyShopFollowKlaviyo({
        followId: inserted.id,
        followedAt: inserted.created_at,
        sellerUserId: sellerId,
        followerUserId: user.id,
        followerEmail: user.email?.trim() ?? null,
      })
    }
  }

  await revalidateSellerProfileAndDirectoryCatalog(supabase, sellerId)
  const { data: updated } = await supabase.from("profiles").select("follower_count").eq("id", sellerId).maybeSingle()
  const followerCount = Math.max(0, Math.floor(Number(updated?.follower_count ?? seller.follower_count) || 0))
  return { ok: true, data: { following, follower_count: followerCount } }
}

export async function setMobileCartItem(
  supabase: SupabaseClient,
  user: User,
  listingId: string,
  quantity: number,
): Promise<MobileApiResult<MobileCartResult>> {
  if (quantity < 1) {
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("profile_id", user.id)
      .eq("listing_id", listingId)
    if (error) return failure(500, "Could not update your cart.")
    revalidatePath("/cart")
    return { ok: true, data: { in_cart: false, quantity: 0 } }
  }

  const check = await assertListingEligibleForCart(supabase, listingId, user.id)
  if (!check.ok) return failure(400, check.message)
  const capError = await peerSurfboardAddCapError(supabase, check.listing, user.id)
  if (capError) return failure(400, capError)

  const isShop = isReswellShopListing(check.listing.section)
  const stock = Math.max(0, Math.floor(Number(check.listing.stock_quantity) || 0))
  const maxQty = isShop ? stock : 1
  if (quantity > maxQty) {
    return failure(400, isShop ? "Not enough stock available" : "This listing is already limited to one")
  }

  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("profile_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle()

  let lineQuantity = quantity
  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity })
      .eq("id", existing.id)
      .eq("profile_id", user.id)
    if (error) return failure(500, "Could not update your cart.")
  } else {
    const { error } = await supabase.from("cart_items").insert({
      profile_id: user.id,
      listing_id: listingId,
      quantity,
    })
    if (error) return failure(500, "Could not add this listing to your cart.")
  }

  const { data: listingRow } = await supabase
    .from("listings")
    .select("id, title, price, slug, section")
    .eq("id", listingId)
    .maybeSingle()
  if (listingRow) {
    const price = Number(listingRow.price)
    void trackKlaviyoAddedToCart({
      buyerUserId: user.id,
      buyerEmail: user.email?.trim() ?? null,
      listingId,
      title: String(listingRow.title ?? ""),
      price: Number.isFinite(price) ? price : 0,
      slug: typeof listingRow.slug === "string" ? listingRow.slug : null,
      section: String(listingRow.section ?? "surfboards"),
      photoUrl: null,
    })
  }
  void captureServerEvent(user.id, "cart_item_added", {
    listing_id: listingId,
    section: check.listing.section,
    quantity: lineQuantity,
  })
  revalidatePath("/cart")
  return { ok: true, data: { in_cart: true, quantity: lineQuantity } }
}

async function deliverMessage(
  supabase: SupabaseClient,
  user: User,
  conversation: { id: string; buyer_id: string; seller_id: string; listing_id: string | null },
  body: string,
): Promise<MobileApiResult<MobileMessageResult>> {
  if (user.id !== conversation.buyer_id && user.id !== conversation.seller_id) {
    return failure(404, "Conversation not found")
  }
  const receiverId = user.id === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id
  const sendGuard = await evaluateUserMessageSend(supabase, user.id, receiverId)
  if (!sendGuard.ok) return failure(429, sendGuard.userMessage)

  const policyDecision = await evaluateMessagePolicyForSend(supabase, user.id, conversation.id, body)
  if (policyDecision) {
    try {
      const service = createServiceRoleClient()
      await captureBlockedFraudMessage(service, {
        conversationId: conversation.id,
        senderId: user.id,
        recipientId: receiverId,
        listingId: conversation.listing_id,
        content: body,
        reasonCode: policyDecision.reasonCode,
        llmReviewStatus: policyDecision.llmReviewStatus,
        llmReviewReasonCode: policyDecision.llmReviewReasonCode,
        llmReviewRationale: policyDecision.llmReviewRationale,
        llmReviewSource: "send",
      })
    } catch (error) {
      console.error("[mobile-api] fraud capture failed", {
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      })
    }
    if (messagePolicyBlocksDelivery(policyDecision.reasonCode)) {
      return failure(400, "That message can't be sent.")
    }
  }

  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversation.id, sender_id: user.id, content: body })
    .select("id, content, created_at")
    .single()
  if (error || !inserted) return failure(500, "Could not send that message.")

  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id)
  revalidateMessagesInboxForParticipants(conversation.buyer_id, conversation.seller_id)

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", user.id)
    .maybeSingle()
  void trackKlaviyoMessageSent({
    senderUserId: user.id,
    receiverUserId: receiverId,
    message: body,
    conversationId: conversation.id,
    listingId: conversation.listing_id,
    messageId: inserted.id,
    sentAt: inserted.created_at,
    sessionSender: { email: user.email ?? null, profile: senderProfile },
  })

  return {
    ok: true,
    data: {
      id: inserted.id,
      conversation_id: conversation.id,
      body: inserted.content,
      created_at: inserted.created_at,
    },
  }
}

export async function sendMobileConversationMessage(
  supabase: SupabaseClient,
  user: User,
  conversationId: string,
  body: string,
): Promise<MobileApiResult<MobileMessageResult>> {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, listing_id")
    .eq("id", conversationId)
    .maybeSingle()
  if (error || !conversation) return failure(404, "Conversation not found")
  return deliverMessage(supabase, user, conversation, body)
}

export async function sendMobileListingMessage(
  supabase: SupabaseClient,
  user: User,
  listingId: string,
  body: string,
): Promise<MobileApiResult<MobileMessageResult>> {
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, user_id")
    .eq("id", listingId)
    .maybeSingle()
  if (error || !listing) return failure(404, "Listing not found")
  if (listing.user_id === user.id) return failure(400, "You can't message yourself about your own listing.")

  const existing = await getConversationForBuyerSellerListing(supabase, user.id, listing.user_id, listingId)
  const conversationId =
    existing?.id ??
    (await ensureConversationForBuyerSellerListing(supabase, user.id, listing.user_id, listingId))?.id
  if (!conversationId) return failure(500, "Could not open this conversation.")

  const { data: ready, error: loadError } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, listing_id")
    .eq("id", conversationId)
    .maybeSingle()
  if (loadError || !ready) return failure(500, "Could not open this conversation.")
  return deliverMessage(supabase, user, ready, body)
}

export async function actOnMobileOffer(
  supabase: SupabaseClient,
  userId: string,
  offerId: string,
  input: MobileOfferActionBody,
): Promise<MobileApiResult<MobileOfferActionResult>> {
  const { data: offer, error } = await supabase
    .from("offers")
    .select("id, buyer_id, seller_id, status")
    .eq("id", offerId)
    .maybeSingle()
  if (error || !offer) return failure(404, "Offer not found.")

  if (offer.seller_id === userId && (input.action === "accept" || input.action === "decline" || input.action === "counter")) {
    const result = await respondToOfferService(supabase, userId, {
      offerId,
      action: input.action,
      counterAmount: input.counter_amount,
      counterNote: input.counter_note,
    })
    if (!result.ok) return failure(400, result.error)
    revalidatePath("/dashboard/offers")
    return { ok: true, data: { offer_id: offerId, removed: false } }
  }

  if (offer.buyer_id === userId && input.action === "withdraw") {
    const result = await withdrawListingOffer(supabase, userId, offerId)
    if (!result.ok) return failure(400, result.error)
    revalidatePath("/dashboard/offers")
    return { ok: true, data: { offer_id: offerId, removed: true } }
  }

  if (offer.buyer_id === userId && (input.action === "accept" || input.action === "decline")) {
    const result = await respondToCounterOfferService(supabase, userId, { offerId, action: input.action })
    if (!result.ok) return failure(400, result.error)
    revalidatePath("/dashboard/offers")
    return { ok: true, data: { offer_id: offerId, removed: input.action === "decline" } }
  }

  return failure(400, "You can't take that action on this offer.")
}
