import {
  mobileProfileAvatarResultSchema,
  mobileProfileBannerResultSchema,
  mobileProfileSettingsPatchSchema,
  mobileProfileSettingsSchema,
  type MobileProfileAvatarResult,
  type MobileProfileBannerResult,
  type MobileProfileSettings,
  type MobileProfileSettingsPatch,
} from "@reswell/api-contract"
import { fetchDashboardProfile } from "@/lib/db/dashboard-profile"
import { fetchProfileAddresses, profileAddressOneLine } from "@/lib/db/profile-addresses"
import { upsertMessageSmsOptInForUser } from "@/lib/db/messageSmsNotifications"
import {
  getPushTopicFlagsForUser,
  patchPushTopicForUser,
  upsertPushOptInForUser,
} from "@/lib/db/pushTokens"
import { anyPushTopicEnabled, type PushTopic } from "@/lib/utils/push-topics"
import { validateDisplayName } from "@/lib/display-name-validation"
import { absoluteProxiedProfileMediaUrl } from "@/lib/public-media-display-src"
import { loadMessageSmsNotificationsStateForUser } from "@/lib/services/messageSmsNotifications"
import { removeProfileAvatar, uploadProcessedProfileAvatar } from "@/lib/services/profileAvatar"
import { removeProfileBanner, uploadProcessedProfileBanner } from "@/lib/services/profileBanner"
import { removeProfileTileBanner, uploadProcessedProfileTileBanner } from "@/lib/services/profileTileBanner"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import type { SupabaseClient, User } from "@supabase/supabase-js"

function media(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  return absoluteProxiedProfileMediaUrl(trimmed) ?? null
}

export async function getMobileProfileSettingsService(
  supabase: SupabaseClient,
  user: User,
): Promise<MobileApiResult<MobileProfileSettings>> {
  const [{ profile, error }, addresses] = await Promise.all([
    fetchDashboardProfile(supabase, user.id),
    fetchProfileAddresses(supabase, user.id),
  ])
  if (error && error !== "Profile not found") {
    return { ok: false, status: 500, error: "Unable to load your profile right now" }
  }
  if (!profile) return { ok: false, status: 404, error: "Profile not found" }
  if (addresses.error) return { ok: false, status: 500, error: "Unable to load your addresses right now" }

  let sms = { message_sms_opt_in: false, phone: null as string | null }
  try {
    const loaded = await loadMessageSmsNotificationsStateForUser(user.id, user.phone)
    sms = { message_sms_opt_in: loaded.message_sms_opt_in, phone: loaded.phone }
  } catch (cause) {
    console.error("[mobile-api] profile sms failed", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }

  let pushTopics = {
    messages: true,
    offers: true,
    saves: true,
    follows: true,
    orders: true,
  }
  try {
    pushTopics = await getPushTopicFlagsForUser(supabase, user.id)
  } catch (cause) {
    console.error("[mobile-api] profile push failed", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }

  const providers = user.app_metadata?.providers
  const signedInWith =
    Array.isArray(providers) && providers.includes("apple")
      ? "apple"
      : Array.isArray(providers) && providers.includes("google")
        ? "google"
        : "email"
  const hasEmailPassword = user.identities?.some((identity) => identity.provider === "email") === true
  const photo = profile.shop_logo_url || profile.avatar_url
  const parsed = mobileProfileSettingsSchema.safeParse({
    display_name: profile.display_name,
    seller_slug: profile.seller_slug,
    email: user.email ?? profile.email ?? null,
    avatar_url: media(photo),
    bio: profile.bio,
    location: profile.location,
    city: profile.city,
    shop_banner_url: media(profile.shop_banner_url),
    shop_tile_banner_url: media(profile.shop_tile_banner_url),
    signed_in_with: signedInWith,
    has_email_password: hasEmailPassword,
    message_sms_opt_in: sms.message_sms_opt_in,
    sms_phone: sms.phone,
    push_opt_in: anyPushTopicEnabled(pushTopics),
    push_messages: pushTopics.messages,
    push_offers: pushTopics.offers,
    push_saves: pushTopics.saves,
    push_follows: pushTopics.follows,
    push_orders: pushTopics.orders,
    addresses: addresses.addresses.map((address) => ({
      id: address.id,
      label: address.label,
      full_name: address.full_name,
      line: profileAddressOneLine(address),
      is_default: address.is_default,
    })),
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load your profile right now" }
  return { ok: true, data: parsed.data }
}

export async function updateMobileProfileSettingsService(
  supabase: SupabaseClient,
  user: User,
  input: MobileProfileSettingsPatch,
): Promise<MobileApiResult<MobileProfileSettings>> {
  const parsed = mobileProfileSettingsPatchSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Check the profile fields." }
  }
  const name = validateDisplayName(parsed.data.display_name, user.email)
  if (!name.valid) return { ok: false, status: 400, error: name.error }

  const profilePatch: {
    display_name: string
    updated_at: string
    bio?: string | null
    location?: string | null
    city?: string | null
  } = {
    display_name: parsed.data.display_name.trim(),
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.bio !== undefined) profilePatch.bio = parsed.data.bio.trim() || null
  if (parsed.data.location !== undefined) profilePatch.location = parsed.data.location.trim() || null
  if (parsed.data.city !== undefined) profilePatch.city = parsed.data.city.trim() || null

  const { error } = await supabase.from("profiles").update(profilePatch).eq("id", user.id)
  if (error) return { ok: false, status: 500, error: "Unable to save your profile right now" }

  if (typeof parsed.data.message_sms_opt_in === "boolean") {
    const saved = await upsertMessageSmsOptInForUser(supabase, user.id, parsed.data.message_sms_opt_in)
    if (!saved.ok) return { ok: false, status: 400, error: saved.error }
  }

  const topicPatch: Partial<Record<PushTopic, boolean>> = {
    messages: parsed.data.push_messages,
    offers: parsed.data.push_offers,
    saves: parsed.data.push_saves,
    follows: parsed.data.push_follows,
    orders: parsed.data.push_orders,
  }
  const topicUpdates = (Object.entries(topicPatch) as Array<[PushTopic, boolean | undefined]>).filter(
    (entry): entry is [PushTopic, boolean] => typeof entry[1] === "boolean",
  )
  if (topicUpdates.length > 0) {
    for (const [topic, enabled] of topicUpdates) {
      const saved = await patchPushTopicForUser(supabase, user.id, topic, enabled)
      if (!saved.ok) return { ok: false, status: 400, error: saved.error }
    }
  } else if (typeof parsed.data.push_opt_in === "boolean") {
    const saved = await upsertPushOptInForUser(supabase, user.id, parsed.data.push_opt_in)
    if (!saved.ok) return { ok: false, status: 400, error: saved.error }
  }

  return getMobileProfileSettingsService(supabase, user)
}

export async function uploadMobileProfileAvatarService(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<MobileApiResult<MobileProfileAvatarResult>> {
  try {
    const uploaded = await uploadProcessedProfileAvatar({ supabase, userId, file })
    const parsed = mobileProfileAvatarResultSchema.safeParse({
      avatar_url: media(uploaded.shopLogoUrl || uploaded.avatarUrl),
    })
    if (!parsed.success) return { ok: false, status: 500, error: "Unable to update your photo right now" }
    return { ok: true, data: parsed.data }
  } catch (cause) {
    console.error("[mobile-api] avatar upload failed", {
      userId,
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return { ok: false, status: 500, error: "Unable to update your photo right now" }
  }
}

async function uploadMobileBanner(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  upload: (params: { supabase: SupabaseClient; userId: string; file: File }) => Promise<{ bannerUrl: string }>,
  label: string,
): Promise<MobileApiResult<MobileProfileBannerResult>> {
  try {
    const uploaded = await upload({ supabase, userId, file })
    const parsed = mobileProfileBannerResultSchema.safeParse({ banner_url: media(uploaded.bannerUrl) })
    if (!parsed.success) return { ok: false, status: 500, error: `Unable to update your ${label} right now` }
    return { ok: true, data: parsed.data }
  } catch (cause) {
    console.error("[mobile-api] banner upload failed", {
      userId,
      label,
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return { ok: false, status: 500, error: `Unable to update your ${label} right now` }
  }
}

export function uploadMobileProfileBannerService(supabase: SupabaseClient, userId: string, file: File) {
  return uploadMobileBanner(supabase, userId, file, uploadProcessedProfileBanner, "seller banner")
}

export function uploadMobileProfileTileBannerService(supabase: SupabaseClient, userId: string, file: File) {
  return uploadMobileBanner(supabase, userId, file, uploadProcessedProfileTileBanner, "tile banner")
}

export async function removeMobileProfileBannerService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileProfileBannerResult>> {
  try {
    await removeProfileBanner({ supabase, userId })
    return { ok: true, data: { banner_url: null } }
  } catch (cause) {
    console.error("[mobile-api] banner remove failed", {
      userId,
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return { ok: false, status: 500, error: "Unable to remove your seller banner right now" }
  }
}

export async function removeMobileProfileTileBannerService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileProfileBannerResult>> {
  try {
    await removeProfileTileBanner({ supabase, userId })
    return { ok: true, data: { banner_url: null } }
  } catch (cause) {
    console.error("[mobile-api] tile banner remove failed", {
      userId,
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return { ok: false, status: 500, error: "Unable to remove your tile banner right now" }
  }
}

export async function removeMobileProfileAvatarService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileProfileAvatarResult>> {
  try {
    await removeProfileAvatar({ supabase, userId })
    return { ok: true, data: { avatar_url: null } }
  } catch (cause) {
    console.error("[mobile-api] avatar remove failed", {
      userId,
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return { ok: false, status: 500, error: "Unable to remove your photo right now" }
  }
}
