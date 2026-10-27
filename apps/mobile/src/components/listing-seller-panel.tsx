import { Link, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileListingDetail } from "@reswell/api-contract"
import { ListingSpecTable, listingSpecRows } from "@/components/listing-spec-table"
import { ProfileCircle } from "@/components/profile-circle"
import { sendListingMessage, setFollow } from "@/lib/api"
import { useAuthGate } from "@/lib/auth-gate"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export function ListingSellerPanel({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const seller = listing.seller
  const [aboutOpen, setAboutOpen] = useState(Boolean(listing.description))
  const specRows = listingSpecRows(listing)

  return (
    <View style={[styles.panel, { borderTopColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Meet the seller</Text>
      <MeetSellerStrip listing={listing} />
      <ListingSpecTable rows={specRows} />
      <Pressable
        style={[styles.accordion, { borderTopColor: colors.border, borderBottomColor: colors.border }]}
        onPress={() => setAboutOpen((open) => !open)}
      >
        <Text style={[styles.accordionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          Seller description
        </Text>
        <SymbolView
          name={{ ios: aboutOpen ? "chevron.up" : "chevron.down", android: aboutOpen ? "expand_less" : "expand_more", web: "expand_more" }}
          size={18}
          tintColor={colors.foreground}
        />
      </Pressable>
      {aboutOpen && listing.description ? (
        <Text style={[styles.description, { color: colors.foreground, fontFamily: fontFamily.text }]}>{listing.description}</Text>
      ) : null}
    </View>
  )
}

function MeetSellerStrip({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const seller = listing.seller
  const router = useRouter()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const viewerId = session?.user?.id ?? null
  const ownSeller = Boolean(viewerId && seller.id === viewerId)

  const [following, setFollowing] = useState(seller.following ?? false)
  const [followBusy, setFollowBusy] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)

  useEffect(() => {
    setFollowing(seller.following ?? false)
  }, [seller.following])

  const hasReviews = seller.review_count > 0

  function openProfile() {
    if (!seller.seller_slug) return
    router.push({ pathname: "/profile/[slug]", params: { slug: seller.seller_slug } })
  }

  function toggleFollow() {
    requestAuth((accessToken) => {
      const next = !following
      setFollowBusy(true)
      void setFollow(accessToken, seller.id, next)
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
          disabled={!seller.seller_slug}
          style={styles.stripIdentity}
          accessibilityRole="button"
          accessibilityLabel={`View ${seller.name} shop`}
        >
          <ProfileCircle url={seller.avatar_url} size={52} />
          <View style={styles.stripCopy}>
            <View style={styles.nameRow}>
              <Text style={[styles.stripName, { color: colors.foreground, fontFamily: fontFamily.text }]} numberOfLines={1}>
                {seller.name}
              </Text>
              {seller.verified ? (
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
                  ? `${seller.rating_average.toFixed(1)} out of 5, ${seller.review_count} ${seller.review_count === 1 ? "review" : "reviews"}`
                  : "No seller reviews yet"
              }
            >
              {hasReviews ? (
                <>
                  <StarRow value={seller.rating_average} size={13} />
                  <Text style={[styles.ratingCount, { color: colors.muted, fontFamily: fontFamily.text }]}>
                    {seller.review_count}
                  </Text>
                </>
              ) : (
                <Text style={[styles.noReviews, { color: colors.muted, fontFamily: fontFamily.text }]}>No reviews yet</Text>
              )}
            </View>
          </View>
        </Pressable>

        {!ownSeller ? (
          <View style={styles.stripActions}>
            <MessageIconButton open={messageOpen} onToggle={() => setMessageOpen((open) => !open)} />
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

      {messageOpen ? <MessageComposer listingId={listing.id} onSent={() => setMessageOpen(false)} /> : null}
      {seller.seller_slug ? (
        <Link href={{ pathname: "/profile/[slug]", params: { slug: seller.seller_slug } }} asChild>
          <Pressable style={styles.shopLink}>
            <Text style={[styles.shopLinkLabel, { color: colors.shipping, fontFamily: fontFamily.text }]}>View shop</Text>
            <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={13} tintColor={colors.shipping} />
          </Pressable>
        </Link>
      ) : null}
    </View>
  )
}

function MessageIconButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const colors = useReswellColors()
  const { requestAuth } = useAuthGate()

  return (
    <Pressable
      onPress={() => requestAuth(onToggle)}
      style={[styles.iconButton, { backgroundColor: colors.image, borderColor: open ? colors.shipping : colors.border }]}
      accessibilityRole="button"
      accessibilityLabel="Message seller"
    >
      <SymbolView name={{ ios: "bubble.left", android: "chat_bubble", web: "chat_bubble" }} size={18} tintColor={colors.shipping} />
    </Pressable>
  )
}

function MessageComposer({ listingId, onSent }: { listingId: string; onSent: () => void }) {
  const colors = useReswellColors()
  const router = useRouter()
  const { requestAuth } = useAuthGate()
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <View style={[styles.messageComposer, { backgroundColor: colors.image, borderColor: colors.border }]}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Message the seller"
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, fontFamily: fontFamily.text }]}
        onSubmitEditing={() => {
          const body = draft.trim()
          if (!body || busy) return
          requestAuth((token) => {
            setBusy(true)
            setError(null)
            void sendListingMessage(token, listingId, body)
              .then((result) => {
                setDraft("")
                onSent()
                router.push({ pathname: "/account/messages/[id]", params: { id: result.conversation_id } })
              })
              .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : "Could not send that message")
              })
              .finally(() => setBusy(false))
          })
        }}
      />
      {busy ? <ActivityIndicator color={colors.foreground} /> : null}
      {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
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
  panel: { marginTop: 22, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20, gap: 12 },
  heading: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
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
  messageComposer: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 8 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 14 },
  accordion: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  accordionLabel: { fontSize: 16, fontWeight: "700" },
  starRow: { flexDirection: "row", gap: 1 },
  description: { fontSize: 16, lineHeight: 26 },
})
