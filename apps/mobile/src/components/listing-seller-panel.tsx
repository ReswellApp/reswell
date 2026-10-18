import { Image } from "expo-image"
import { Link, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileListingDetail, MobileReview } from "@reswell/api-contract"
import { fetchProfileReviews, sendListingMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export function ListingSellerPanel({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const seller = listing.seller
  const [aboutOpen, setAboutOpen] = useState(Boolean(listing.description))
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <View style={[styles.panel, { borderTopColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.text }]}>About the seller</Text>
      <View style={styles.identity}>
        <Avatar name={seller.name} url={seller.avatar_url} />
        <View style={styles.identityCopy}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.text }]}>{seller.name}</Text>
            {seller.verified ? (
              <SymbolView name={{ ios: "checkmark.seal.fill", android: "verified", web: "verified" }} size={16} tintColor={colors.shipping} />
            ) : null}
          </View>
          {seller.location_label ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{seller.location_label}</Text>
          ) : null}
          {seller.joined_year ? (
            <Text style={[styles.joined, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              Joined Reswell: {seller.joined_year}
            </Text>
          ) : null}
        </View>
      </View>
      <MessageButton listingId={listing.id} open={contactOpen} onOpen={() => setContactOpen(true)} />
      {seller.seller_slug ? (
        <Link href={{ pathname: "/profile/[slug]", params: { slug: seller.seller_slug } }} asChild>
          <Pressable style={StyleSheet.flatten([styles.button, { backgroundColor: colors.image }])}>
            <Text style={[styles.buttonLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              View more from this shop
            </Text>
          </Pressable>
        </Link>
      ) : null}
      <ReviewsRow seller={seller} />
      <Pressable
        style={[styles.accordion, { borderTopColor: colors.border, borderBottomColor: colors.border }]}
        onPress={() => setAboutOpen((open) => !open)}
      >
        <Text style={[styles.accordionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          About this listing
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
      <Pressable
        style={[styles.accordion, { borderBottomColor: colors.border }]}
        onPress={() => setContactOpen((open) => !open)}
      >
        <Text style={[styles.accordionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Contact seller</Text>
        <SymbolView
          name={{ ios: contactOpen ? "chevron.up" : "chevron.down", android: contactOpen ? "expand_less" : "expand_more", web: "expand_more" }}
          size={18}
          tintColor={colors.foreground}
        />
      </Pressable>
    </View>
  )
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const colors = useReswellColors()
  if (url) return <Image source={{ uri: url }} style={styles.avatar} contentFit="cover" />
  return (
    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.image }]}>
      <Text style={[styles.avatarLabel, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  )
}

function MessageButton({ listingId, open, onOpen }: { listingId: string; open: boolean; onOpen: () => void }) {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <View style={styles.messageBlock}>
      <Pressable style={[styles.button, { backgroundColor: colors.image }]} onPress={onOpen}>
        <SymbolView name={{ ios: "bubble.left", android: "chat_bubble", web: "chat_bubble" }} size={16} tintColor={colors.foreground} />
        <Text style={[styles.buttonLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Message seller</Text>
      </Pressable>
      {open ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message the seller"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.image, fontFamily: fontFamily.text }]}
          onSubmitEditing={() => {
            const token = session?.access_token
            const body = draft.trim()
            if (!token) {
              router.push("/sign-in")
              return
            }
            if (!body || busy) return
            setBusy(true)
            setError(null)
            void sendListingMessage(token, listingId, body)
              .then((result) => {
                setDraft("")
                router.push({ pathname: "/account/messages/[id]", params: { id: result.conversation_id } })
              })
              .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : "Could not send that message")
              })
              .finally(() => setBusy(false))
          }}
        />
      ) : null}
      {busy ? <ActivityIndicator color={colors.foreground} /> : null}
      {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
    </View>
  )
}

function ReviewsRow({ seller }: { seller: MobileListingDetail["seller"] }) {
  const colors = useReswellColors()
  const [open, setOpen] = useState(false)
  const [reviews, setReviews] = useState<MobileReview[] | null>(null)
  const [failed, setFailed] = useState(false)

  function toggle() {
    const next = !open
    setOpen(next)
    if (!next || reviews || !seller.seller_slug) return
    void fetchProfileReviews(seller.seller_slug)
      .then((page) => setReviews(page.reviews))
      .catch(() => setFailed(true))
  }

  return (
    <View style={[styles.reviews, { borderTopColor: colors.border }]}>
      <Pressable style={styles.accordion} onPress={toggle}>
        <View style={styles.reviewTitle}>
          <Text style={[styles.accordionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            Seller reviews ({seller.review_count})
          </Text>
          <Stars value={seller.rating_average} />
        </View>
        <SymbolView
          name={{ ios: open ? "chevron.up" : "chevron.down", android: open ? "expand_less" : "expand_more", web: "expand_more" }}
          size={18}
          tintColor={colors.foreground}
        />
      </Pressable>
      {open ? (
        <View style={styles.reviewList}>
          {!seller.seller_slug ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>This seller has no public shop yet.</Text>
          ) : failed ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>Reviews are unavailable right now.</Text>
          ) : reviews == null ? (
            <ActivityIndicator color={colors.foreground} />
          ) : reviews.length === 0 ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>No reviews yet.</Text>
          ) : (
            reviews.slice(0, 3).map((review) => (
              <Text key={review.id} style={[styles.review, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {review.reviewer_name}: {review.comment ?? `${review.rating} stars`}
              </Text>
            ))
          )}
        </View>
      ) : null}
    </View>
  )
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(Math.min(5, Math.max(0, value)))
  return <Text style={styles.stars}>{"★★★★★".slice(0, filled)}<Text style={styles.starsEmpty}>{"★★★★★".slice(filled)}</Text></Text>
}

const styles = StyleSheet.create({
  panel: { marginTop: 22, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20, gap: 12 },
  heading: { fontSize: 20, fontWeight: "700" },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  identityCopy: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 14 },
  joined: { fontSize: 14, fontWeight: "700" },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarLabel: { fontSize: 20, fontWeight: "700" },
  button: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  messageBlock: { gap: 8 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 14 },
  reviews: { borderTopWidth: StyleSheet.hairlineWidth },
  accordion: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  accordionLabel: { fontSize: 16, fontWeight: "700" },
  reviewTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  reviewList: { gap: 8, paddingBottom: 8 },
  review: { fontSize: 14, lineHeight: 20 },
  stars: { color: "#E0A100", fontSize: 14 },
  starsEmpty: { color: "#D6D3D1" },
  description: { fontSize: 16, lineHeight: 26 },
})
