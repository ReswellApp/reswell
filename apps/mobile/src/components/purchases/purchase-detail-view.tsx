import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useState, type ComponentProps } from "react"
import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native"
import type { MobilePurchaseDetail, MobilePurchaseStatusTone } from "@reswell/api-contract"
import { ProfileCircle } from "@/components/profile-circle"
import { openProfileConversation } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatPurchaseDate, formatPurchaseDateTime } from "@/lib/purchase-display"
import { publicSiteUrl } from "@/lib/public-env"
import { fontFamily, useReswellColors } from "@/theme"

const STATUS_BANNER: Record<MobilePurchaseStatusTone, { backgroundColor: string; color: string }> = {
  success: { backgroundColor: "#F0FDF4", color: "#14532D" },
  warning: { backgroundColor: "#FFFBEB", color: "#451A03" },
  danger: { backgroundColor: "#FFF1F2", color: "#881337" },
  neutral: { backgroundColor: "#F8FAFC", color: "#1E293B" },
}

function ActionRow({
  symbol,
  label,
  onPress,
}: {
  symbol: ComponentProps<typeof SymbolView>["name"]
  label: string
  onPress: () => void
}) {
  const colors = useReswellColors()
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.action}>
      <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
        <SymbolView name={symbol} size={14} tintColor={colors.primaryForeground} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
      <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={16} tintColor={colors.muted} />
    </Pressable>
  )
}

export function PurchaseDetailView({ purchase }: { purchase: MobilePurchaseDetail }) {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const accent = colors.sellerProfileBannerDefault
  const banner = STATUS_BANNER[purchase.status_tone]
  const card = { backgroundColor: colors.secondary }
  const [copied, setCopied] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [openingMessage, setOpeningMessage] = useState(false)

  const openListing = (listingId: string | null, listingSlug: string | null) => {
    const id = listingSlug || listingId
    if (!id) return
    router.push({ pathname: "/listing/[id]", params: { id } })
  }

  const openSeller = () => {
    if (purchase.seller_handle) {
      router.push({ pathname: "/profile/[slug]", params: { slug: purchase.seller_handle } })
    }
  }

  const openShopAgain = () => {
    if (purchase.listing_slug || purchase.listing_id) {
      openListing(purchase.listing_id, purchase.listing_slug)
      return
    }
    openSeller()
  }

  const openSellerMessages = () => {
    if (purchase.conversation_id) {
      router.push({ pathname: "/account/messages/[id]", params: { id: purchase.conversation_id } })
      return
    }
    const token = session?.access_token
    if (!token || !purchase.seller_handle || openingMessage) return
    setOpeningMessage(true)
    setMessageError(null)
    void openProfileConversation(token, purchase.seller_handle)
      .then((result) => router.push({ pathname: "/account/messages/[id]", params: { id: result.conversation_id } }))
      .catch((cause: unknown) => setMessageError(cause instanceof Error ? cause.message : "Unable to message the seller"))
      .finally(() => setOpeningMessage(false))
  }

  return (
    <View style={styles.page}>
      <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Track and manage your orders.
      </Text>
      <Pressable
        onPress={() => router.push("/account/purchases")}
        accessibilityRole="button"
        accessibilityLabel="Back to list"
        style={[styles.back, { backgroundColor: colors.image }]}
      >
        <SymbolView name={{ ios: "chevron.left", android: "chevron_left", web: "chevron_left" }} size={16} tintColor={accent} />
        <Text style={[styles.backLabel, { color: accent, fontFamily: fontFamily.text }]}>Back to List</Text>
      </Pressable>

      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Purchase Details</Text>

      <View style={[styles.card, card]}>
        {purchase.items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => openListing(item.listing_id, item.listing_slug)}
            style={styles.item}
            accessibilityRole="link"
            accessibilityLabel={item.title}
          >
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={[styles.itemImage, { backgroundColor: colors.image }]} contentFit="cover" />
            ) : (
              <View style={[styles.itemImage, styles.imageFallback, { backgroundColor: colors.image }]}>
                <SymbolView name={{ ios: "shippingbox", android: "inventory_2", web: "inventory_2" }} size={18} tintColor={colors.muted} />
              </View>
            )}
            <View style={styles.itemCopy}>
              <Text style={[styles.itemTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{item.title}</Text>
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>by {item.seller_name}</Text>
              {item.detail_line ? (
                <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{item.detail_line}</Text>
              ) : null}
              {item.price_label ? (
                <Text style={[styles.itemPrice, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.price_label}</Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>

      {purchase.existing_review ? (
        <View style={[styles.card, styles.reviewRow, card]}>
          <Text style={[styles.reviewTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Your review</Text>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {purchase.existing_review.rating}/5
            {purchase.existing_review.comment ? ` — ${purchase.existing_review.comment}` : ""}
          </Text>
        </View>
      ) : purchase.hide_review_prompt ? null : (
        <View style={[styles.card, styles.reviewRow, card]}>
          <SymbolView name={{ ios: "star", android: "star", web: "star" }} size={16} tintColor={colors.muted} />
          <Text style={[styles.reviewPrompt, { color: colors.muted, fontFamily: fontFamily.text }]}>Leave a review for the seller</Text>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="You can review the seller after this order is delivered or picked up."
          >
            <SymbolView
              name={{ ios: "info.circle", android: "info", web: "info" }}
              size={16}
              tintColor={accent}
            />
          </View>
        </View>
      )}

      <View style={[styles.card, card]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Order Details</Text>
        <View style={[styles.dlRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.dt, { color: colors.muted, fontFamily: fontFamily.text }]}>Order number</Text>
          <Pressable
            onPress={() => {
              void Share.share({ message: purchase.order_number }).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }}
            accessibilityRole="button"
            accessibilityLabel={copied ? "Order number copied" : "Share or copy order number"}
            style={styles.orderNumber}
          >
            <Text selectable style={[styles.dd, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {purchase.order_number}
            </Text>
            <SymbolView
              name={{ ios: copied ? "checkmark" : "doc.on.doc", android: copied ? "check" : "content_copy", web: "content_copy" }}
              size={14}
              tintColor={colors.muted}
            />
          </Pressable>
        </View>
        <View style={[styles.dlRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.dt, { color: colors.muted, fontFamily: fontFamily.text }]}>Subtotal</Text>
          <Text style={[styles.dd, { color: colors.foreground, fontFamily: fontFamily.text }]}>{purchase.item_amount_label}</Text>
        </View>
        {purchase.show_shipping ? (
          <View style={[styles.dlRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.dt, { color: colors.muted, fontFamily: fontFamily.text }]}>Shipping</Text>
            <Text style={[styles.dd, { color: colors.foreground, fontFamily: fontFamily.text }]}>{purchase.shipping_amount_label}</Text>
          </View>
        ) : null}
        <View style={styles.dlRowLast}>
          <Text style={[styles.totalLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Total</Text>
          <Text
            style={[
              styles.totalValue,
              { color: accent, fontFamily: fontFamily.text, textDecorationLine: purchase.amount_struck ? "line-through" : "none" },
            ]}
          >
            {purchase.total_amount_label}
          </Text>
        </View>
        {purchase.refund_note ? (
          <Text style={[styles.refund, { color: colors.destructive, fontFamily: fontFamily.text }]}>{purchase.refund_note}</Text>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: banner.backgroundColor }]}>
        <Text style={[styles.statusKicker, { color: banner.color, fontFamily: fontFamily.text }]}>ORDER STATUS</Text>
        <Text style={[styles.statusLabel, { color: banner.color, fontFamily: fontFamily.headline }]}>{purchase.status_label}</Text>
        {purchase.status_date ? (
          <Text style={[styles.statusDate, { color: banner.color, fontFamily: fontFamily.text }]}>
            {formatPurchaseDate(purchase.status_date, "long")}
          </Text>
        ) : null}
      </View>

      {purchase.shipping_days_left != null && purchase.shipping_deadline ? (
        <Text style={[styles.deadline, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {purchase.shipping_days_left > 0
            ? `Sellers are expected to ship within ${purchase.shipping_window_days} days. If this has not shipped by ${formatPurchaseDate(purchase.shipping_deadline)} (${purchase.shipping_days_left} ${purchase.shipping_days_left === 1 ? "day" : "days"} left), message the seller or message Reswell.`
            : `The ${purchase.shipping_window_days}-day shipping window has passed. Message Reswell if you need help with this order.`}
        </Text>
      ) : null}

      <View style={styles.timelineBlock}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          {purchase.timeline_heading}
        </Text>
        {purchase.timeline.map((step, index) => {
          const last = index === purchase.timeline.length - 1
          const upcoming = step.state === "upcoming"
          return (
            <View key={step.id} style={styles.timelineRow}>
              {!last ? (
                <View
                  style={[
                    styles.timelineLine,
                    { backgroundColor: upcoming ? colors.border : "rgba(22, 163, 74, 0.5)" },
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.dot,
                  upcoming
                    ? { borderWidth: 1, borderColor: colors.muted, backgroundColor: colors.background }
                    : { backgroundColor: "#16A34A" },
                ]}
              />
              <View style={styles.timelineCopy}>
                <Text
                  style={[
                    styles.timelineTitle,
                    { color: upcoming ? colors.muted : accent, fontFamily: fontFamily.text },
                  ]}
                >
                  {step.title}
                </Text>
                {step.occurred_at ? (
                  <Text style={[styles.timelineDate, { color: colors.muted, fontFamily: fontFamily.text }]}>
                    {formatPurchaseDateTime(step.occurred_at)}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>

      {purchase.address_lines.length > 0 ? (
        <View style={[styles.card, styles.address, card]}>
          <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
            <SymbolView name={{ ios: "mappin", android: "location_on", web: "location_on" }} size={16} tintColor={colors.primaryForeground} />
          </View>
          <View style={styles.addressCopy}>
            <Text style={[styles.addressKicker, { color: colors.muted, fontFamily: fontFamily.text }]}>SHIPPING ADDRESS</Text>
            {purchase.address_name ? (
              <Text style={[styles.addressName, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {purchase.address_name}
              </Text>
            ) : null}
            {purchase.address_lines.map((line) => (
              <Text key={line} selectable style={[styles.addressLine, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {purchase.track_url ? (
        <Pressable
          onPress={() => void Linking.openURL(purchase.track_url ?? "")}
          accessibilityRole="link"
          accessibilityLabel="Track your order"
          style={[styles.track, { backgroundColor: "rgba(127, 157, 213, 0.15)" }]}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
            <SymbolView name={{ ios: "truck.box", android: "local_shipping", web: "local_shipping" }} size={16} tintColor={colors.primaryForeground} />
          </View>
          <Text style={[styles.trackLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Track your order</Text>
          <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={16} tintColor={colors.muted} />
        </Pressable>
      ) : null}

      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Seller</Text>
        <Pressable onPress={openSeller} style={styles.seller} accessibilityRole="link" accessibilityLabel={purchase.seller_name}>
          <ProfileCircle url={purchase.seller_avatar_url} size={40} />
          <View>
            <Text style={[styles.sellerName, { color: colors.foreground, fontFamily: fontFamily.text }]}>{purchase.seller_name}</Text>
            {purchase.seller_handle ? (
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>@{purchase.seller_handle}</Text>
            ) : null}
          </View>
        </Pressable>
        <ActionRow
          symbol={{ ios: "bubble.left", android: "chat_bubble", web: "chat_bubble" }}
          label={openingMessage ? "Opening messages…" : "Message the seller"}
          onPress={openSellerMessages}
        />
        <ActionRow
          symbol={{ ios: "storefront", android: "storefront", web: "storefront" }}
          label="Shop here again"
          onPress={openShopAgain}
        />
        {purchase.review_from_seller ? (
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {purchase.seller_name} rated you {purchase.review_from_seller.rating}/5
            {purchase.review_from_seller.comment ? ` — ${purchase.review_from_seller.comment}` : "."}
          </Text>
        ) : null}
        {messageError ? (
          <Text style={[styles.refund, { color: colors.destructive, fontFamily: fontFamily.text }]}>{messageError}</Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Need help?</Text>
        <ActionRow
          symbol={{ ios: "questionmark.circle", android: "help", web: "help" }}
          label="Help center"
          onPress={() => void Linking.openURL(`${publicSiteUrl().replace(/\/$/, "")}/help`)}
        />
        <ActionRow
          symbol={{ ios: "bubble.left", android: "chat_bubble", web: "chat_bubble" }}
          label="Message Reswell"
          onPress={() => router.push("/account/support")}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 16 },
  subtitle: { fontSize: 15, lineHeight: 20 },
  back: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backLabel: { fontSize: 14, fontWeight: "600" },
  heading: { fontSize: 26, fontWeight: "700", letterSpacing: -0.4 },
  card: { borderRadius: 14, borderCurve: "continuous", padding: 16, gap: 12 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  itemImage: { width: 64, height: 64, borderRadius: 10, borderCurve: "continuous" },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  itemCopy: { flex: 1, minWidth: 0, gap: 1 },
  itemTitle: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  itemPrice: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 14, lineHeight: 20 },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  reviewPrompt: { flex: 1, fontSize: 14 },
  reviewTitle: { fontSize: 14, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  dlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  dlRowLast: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 12 },
  dt: { fontSize: 14 },
  dd: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  orderNumber: { flexDirection: "row", alignItems: "center", gap: 6 },
  totalLabel: { fontSize: 14, fontWeight: "700" },
  totalValue: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  refund: { fontSize: 12, fontWeight: "600" },
  statusKicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  statusLabel: { fontSize: 18, fontWeight: "700", lineHeight: 22 },
  statusDate: { fontSize: 14 },
  deadline: { fontSize: 14, lineHeight: 20 },
  timelineBlock: { gap: 12 },
  timelineRow: { position: "relative", flexDirection: "row", gap: 12, paddingBottom: 16 },
  timelineLine: { position: "absolute", left: 5, top: 12, width: StyleSheet.hairlineWidth + 1, bottom: 0 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineCopy: { flex: 1, minWidth: 0 },
  timelineTitle: { fontSize: 14, fontWeight: "600" },
  timelineDate: { fontSize: 12, marginTop: 2 },
  address: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  addressCopy: { flex: 1, minWidth: 0 },
  addressKicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  addressName: { fontSize: 14, fontWeight: "700", textTransform: "uppercase" },
  addressLine: { fontSize: 14, lineHeight: 20 },
  track: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderCurve: "continuous", paddingHorizontal: 16, paddingVertical: 12 },
  trackLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  block: { gap: 4, paddingTop: 4 },
  seller: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  sellerName: { fontSize: 16, fontWeight: "600" },
  action: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  actionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
})
