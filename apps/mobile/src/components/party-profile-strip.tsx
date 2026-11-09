import { Link, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileOrderParty } from "@reswell/api-contract"
import { ProfileCircle } from "@/components/profile-circle"
import { setFollow } from "@/lib/api"
import { useAuthGate } from "@/lib/auth-gate"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export function PartyProfileStrip({
  party,
  messageLabel,
  onMessage,
}: {
  party: MobileOrderParty
  messageLabel: string
  onMessage?: () => void
}) {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const viewerId = session?.user?.id ?? null
  const ownParty = Boolean(viewerId && party.id === viewerId)
  const [following, setFollowing] = useState(party.following ?? false)
  const [followBusy, setFollowBusy] = useState(false)

  useEffect(() => {
    setFollowing(party.following ?? false)
  }, [party.following])

  const hasReviews = party.review_count > 0

  function openProfile() {
    if (!party.seller_slug) return
    router.push({ pathname: "/profile/[slug]", params: { slug: party.seller_slug } })
  }

  function toggleFollow() {
    requestAuth((accessToken) => {
      const next = !following
      setFollowBusy(true)
      void setFollow(accessToken, party.id, next)
        .then((result) => setFollowing(result.following))
        .catch(() => undefined)
        .finally(() => setFollowBusy(false))
    })
  }

  return (
    <View style={styles.stripBlock}>
      <View style={[styles.strip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Pressable
          onPress={openProfile}
          disabled={!party.seller_slug}
          style={styles.stripIdentity}
          accessibilityRole="button"
          accessibilityLabel={party.seller_slug ? `View ${party.name} shop` : party.name}
        >
          <ProfileCircle url={party.avatar_url} size={52} />
          <View style={styles.stripCopy}>
            <View style={styles.nameRow}>
              <Text style={[styles.stripName, { color: colors.foreground, fontFamily: fontFamily.text }]} numberOfLines={1}>
                {party.name}
              </Text>
              {party.verified ? (
                <SymbolView
                  name={{ ios: "checkmark.seal.fill", android: "verified", web: "verified" }}
                  size={15}
                  tintColor={colors.shipping}
                />
              ) : null}
            </View>
            <View
              style={styles.ratingRow}
              accessible
              accessibilityLabel={
                hasReviews
                  ? `${party.rating_average.toFixed(1)} out of 5, ${party.review_count} ${party.review_count === 1 ? "review" : "reviews"}`
                  : "No reviews yet"
              }
            >
              {hasReviews ? (
                <>
                  <StarRow value={party.rating_average} size={13} />
                  <Text style={[styles.ratingCount, { color: colors.muted, fontFamily: fontFamily.text }]}>
                    {party.review_count}
                  </Text>
                </>
              ) : (
                <Text style={[styles.noReviews, { color: colors.muted, fontFamily: fontFamily.text }]}>No reviews yet</Text>
              )}
            </View>
          </View>
        </Pressable>

        {!ownParty ? (
          <View style={styles.stripActions}>
            {onMessage ? (
              <Pressable
                onPress={() => requestAuth(onMessage)}
                style={[styles.iconButton, { backgroundColor: colors.image, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={messageLabel}
              >
                <SymbolView
                  name={{ ios: "bubble.left", android: "chat_bubble", web: "chat_bubble" }}
                  size={18}
                  tintColor={colors.shipping}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={toggleFollow}
              disabled={followBusy}
              style={[
                styles.followPill,
                {
                  backgroundColor: following ? colors.image : colors.protection,
                  borderColor: following ? colors.border : "transparent",
                },
              ]}
            >
              {followBusy ? (
                <ActivityIndicator color={colors.shipping} size="small" />
              ) : (
                <Text style={[styles.followLabel, { color: colors.shipping, fontFamily: fontFamily.text }]}>
                  {following ? "Following" : "Follow"}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>

      {party.seller_slug ? (
        <Link href={{ pathname: "/profile/[slug]", params: { slug: party.seller_slug } }} asChild>
          <Pressable style={styles.shopLink}>
            <Text style={[styles.shopLinkLabel, { color: colors.shipping, fontFamily: fontFamily.text }]}>View shop</Text>
            <SymbolView
              name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
              size={13}
              tintColor={colors.shipping}
            />
          </Pressable>
        </Link>
      ) : null}
    </View>
  )
}

function StarRow({ value, size }: { value: number; size: number }) {
  const colors = useReswellColors()
  const filled = Math.round(Math.min(5, Math.max(0, value)))
  return (
    <View style={styles.starRow} accessibilityLabel={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <SymbolView
          key={star}
          name={{ ios: star <= filled ? "star.fill" : "star", android: star <= filled ? "star" : "star_border", web: "star" }}
          size={size}
          tintColor={colors.reviewStar}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  stripBlock: { gap: 10 },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  stripIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  stripCopy: { flex: 1, gap: 6, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  stripName: { flexShrink: 1, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  ratingCount: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  noReviews: { fontSize: 13 },
  stripActions: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  followPill: {
    minWidth: 76,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  followLabel: { fontSize: 14, fontWeight: "700" },
  shopLink: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingHorizontal: 2 },
  shopLinkLabel: { fontSize: 14, fontWeight: "600" },
  starRow: { flexDirection: "row", gap: 1 },
})
