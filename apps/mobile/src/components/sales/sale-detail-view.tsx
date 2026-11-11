import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useState, type ComponentProps } from "react"
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type { MobilePurchaseStatusTone, MobileSaleDetail } from "@reswell/api-contract"
import { OrderReviewSheet, ReviewPromptRow } from "@/components/order-review-sheet"
import { PartyProfileStrip } from "@/components/party-profile-strip"
import { verifySalePickup } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatPurchaseDate, formatPurchaseDateTime } from "@/lib/purchase-display"
import { saleLabelHref } from "@/lib/sale-label-href"
import { trackPackageHref } from "@/lib/track-package"
import { fontFamily, useReswellColors } from "@/theme"

const STATUS_BANNER: Record<MobilePurchaseStatusTone, { backgroundColor: string; color: string }> = {
  success: { backgroundColor: "#F0FDF4", color: "#14532D" },
  warning: { backgroundColor: "#FFFBEB", color: "#451A03" },
  danger: { backgroundColor: "#FFF1F2", color: "#881337" },
  neutral: { backgroundColor: "#F8FAFC", color: "#1E293B" },
}

function ActionBlock({
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: "rgba(127, 157, 213, 0.15)" }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
        <SymbolView name={symbol} size={16} tintColor={colors.primaryForeground} />
      </View>
      <Text style={[styles.trackLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
      <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={16} tintColor={colors.muted} />
    </Pressable>
  )
}

export function SaleDetailView({
  sale,
  onVerified,
}: {
  sale: MobileSaleDetail
  onVerified: () => void
}) {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const accent = colors.sellerProfileBannerDefault
  const banner = STATUS_BANNER[sale.status_tone]
  const card = { backgroundColor: colors.secondary }
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const openListing = (listingId: string | null, listingSlug: string | null) => {
    const id = listingSlug || listingId
    if (!id) return
    router.push({ pathname: "/listing/[id]", params: { id } })
  }

  const submitPickupCode = () => {
    const token = session?.access_token
    const trimmed = code.trim()
    if (!token || verifying) return
    if (!trimmed) {
      setVerifyError("Enter the 6-digit code from the buyer")
      return
    }
    setVerifying(true)
    setVerifyError(null)
    void verifySalePickup(token, sale.id, trimmed)
      .then(() => {
        setCode("")
        onVerified()
      })
      .catch((cause: unknown) => {
        setVerifyError(cause instanceof Error ? cause.message : "Verification failed")
      })
      .finally(() => setVerifying(false))
  }

  const openLabel = () => {
    const href = saleLabelHref(sale.id)
    if (href) router.push(href)
  }

  return (
    <View style={styles.page}>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Sale Details</Text>

      <View style={[styles.card, card]}>
        {sale.items.map((item) => (
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
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>to {item.buyer_name}</Text>
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

      <ReviewPromptRow
        existing={sale.existing_review}
        canReview={sale.can_review}
        hidePrompt={sale.hide_review_prompt}
        actionLabel="Leave a review for the buyer"
        waitingLabel="You can review the buyer after this order is delivered or picked up."
        existingTitle="Your buyer review"
        onPress={() => setReviewOpen(true)}
      />

      <View style={[styles.card, card]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Order Details</Text>
        <View style={[styles.dlRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.dt, { color: colors.muted, fontFamily: fontFamily.text }]}>Order number</Text>
          <Pressable
            onPress={() => {
              void Share.share({ message: sale.order_number }).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }}
            accessibilityRole="button"
            accessibilityLabel={copied ? "Order number copied" : "Share or copy order number"}
            style={styles.orderNumber}
          >
            <Text selectable style={[styles.dd, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {sale.order_number}
            </Text>
            <SymbolView
              name={{ ios: copied ? "checkmark" : "doc.on.doc", android: copied ? "check" : "content_copy", web: "content_copy" }}
              size={14}
              tintColor={colors.muted}
            />
          </Pressable>
        </View>
        <View style={[styles.dlRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.dt, { color: colors.muted, fontFamily: fontFamily.text }]}>Item price</Text>
          <Text style={[styles.dd, { color: colors.foreground, fontFamily: fontFamily.text }]}>{sale.item_amount_label}</Text>
        </View>
        {sale.show_shipping ? (
          <View style={[styles.dlRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.dt, { color: colors.muted, fontFamily: fontFamily.text }]}>Shipping</Text>
            <Text style={[styles.dd, { color: colors.foreground, fontFamily: fontFamily.text }]}>{sale.shipping_label}</Text>
          </View>
        ) : null}
        {sale.show_platform_fee ? (
          <View style={[styles.dlRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.dt, { color: colors.muted, fontFamily: fontFamily.text }]}>Platform fee</Text>
            <Text style={[styles.dd, { color: colors.foreground, fontFamily: fontFamily.text }]}>{sale.platform_fee_label}</Text>
          </View>
        ) : null}
        <View style={[styles.dlRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.dt, { color: colors.muted, fontFamily: fontFamily.text }]}>Payment</Text>
          <Text style={[styles.dd, { color: colors.foreground, fontFamily: fontFamily.text }]}>{sale.payment_label}</Text>
        </View>
        <View style={styles.dlRowLast}>
          <Text style={[styles.totalLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Your earnings</Text>
          <Text
            style={[
              styles.totalValue,
              { color: accent, fontFamily: fontFamily.text, textDecorationLine: sale.amount_struck ? "line-through" : "none" },
            ]}
          >
            {sale.seller_earnings_label}
          </Text>
        </View>
        {sale.promo_note ? (
          <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>{sale.promo_note}</Text>
        ) : null}
        {sale.shipping_note ? (
          <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>{sale.shipping_note}</Text>
        ) : null}
        {sale.refund_note ? (
          <Text style={[styles.refund, { color: colors.destructive, fontFamily: fontFamily.text }]}>{sale.refund_note}</Text>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: banner.backgroundColor }]}>
        <Text style={[styles.statusKicker, { color: banner.color, fontFamily: fontFamily.text }]}>ORDER STATUS</Text>
        <Text style={[styles.statusLabel, { color: banner.color, fontFamily: fontFamily.headline }]}>{sale.status_label}</Text>
        {sale.status_date ? (
          <Text style={[styles.statusDate, { color: banner.color, fontFamily: fontFamily.text }]}>
            {sale.status_date_includes_time
              ? formatPurchaseDateTime(sale.status_date)
              : formatPurchaseDate(sale.status_date, "long")}
          </Text>
        ) : null}
      </View>

      {sale.timeline_heading && sale.timeline.length > 0 ? (
        <View style={styles.timelineBlock}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {sale.timeline_heading}
          </Text>
          {sale.timeline.map((step, index) => {
            const last = index === sale.timeline.length - 1
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
      ) : null}

      {sale.delivery_badge_label || sale.payout_badge_label ? (
        <View style={styles.badges}>
          {sale.delivery_badge_label ? (
            <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.badgeLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {sale.delivery_badge_label}
              </Text>
            </View>
          ) : null}
          {sale.payout_badge_label ? (
            <View style={[styles.badge, styles.badgeOutline, { borderColor: colors.border }]}>
              <Text style={[styles.badgeLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {sale.payout_badge_label}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {sale.address_lines.length > 0 ? (
        <View style={[styles.card, styles.address, card]}>
          <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
            <SymbolView name={{ ios: "mappin", android: "location_on", web: "location_on" }} size={14} tintColor={colors.primaryForeground} />
          </View>
          <View style={styles.addressCopy}>
            <Text style={[styles.addressKicker, { color: colors.muted, fontFamily: fontFamily.text }]}>SHIPPING ADDRESS</Text>
            {sale.address_name ? (
              <Text style={[styles.addressName, { color: colors.foreground, fontFamily: fontFamily.text }]}>{sale.address_name}</Text>
            ) : null}
            {sale.address_lines.map((line) => (
              <Text key={line} style={[styles.meta, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {sale.track_url ? (
        <ActionBlock
          symbol={{ ios: "truck.box", android: "local_shipping", web: "local_shipping" }}
          label="Track your order"
          onPress={() => {
            const href = trackPackageHref(sale.id)
            if (href) router.push(href)
          }}
        />
      ) : null}

      {sale.can_verify_pickup ? (
        <View style={[styles.card, styles.verifyCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <View style={styles.verifyHeader}>
            <View style={[styles.verifyIcon, { backgroundColor: colors.image }]}>
              <SymbolView name={{ ios: "shippingbox", android: "inventory_2", web: "inventory_2" }} size={16} tintColor={colors.foreground} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Verify pickup</Text>
          </View>
          <Text style={[styles.verifyHint, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Ask the buyer for their 6-digit pickup code. Entering it releases your payout.
          </Text>
          <TextInput
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/[^\d]/g, "").slice(0, 6))
              if (verifyError) setVerifyError(null)
            }}
            placeholder="6-digit pickup code"
            placeholderTextColor={colors.muted}
            accessibilityLabel="6-digit pickup code"
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            autoCorrect={false}
            style={[
              styles.codeInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
                fontFamily: fontFamily.text,
              },
            ]}
          />
          {verifyError ? (
            <Text style={[styles.refund, { color: colors.destructive, fontFamily: fontFamily.text }]}>{verifyError}</Text>
          ) : null}
          <Pressable
            onPress={submitPickupCode}
            disabled={verifying}
            accessibilityRole="button"
            accessibilityLabel="Verify code"
            style={[styles.verifyButton, { backgroundColor: colors.foreground, opacity: verifying ? 0.7 : 1 }]}
          >
            {verifying ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <SymbolView name={{ ios: "checkmark.circle", android: "check_circle", web: "check_circle" }} size={16} tintColor={colors.background} />
            )}
            <Text style={[styles.verifyButtonLabel, { color: colors.background, fontFamily: fontFamily.text }]}>
              {verifying ? "Verifying…" : "Verify code"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {sale.label_available ? (
        <ActionBlock
          symbol={{ ios: "doc.text", android: "description", web: "description" }}
          label="View shipping label"
          onPress={openLabel}
        />
      ) : null}

      {sale.can_request_support ? (
        <Pressable
          onPress={() => router.push("/account/support")}
          accessibilityRole="button"
          accessibilityLabel="Get help with this sale"
          style={[styles.helpButton, { borderColor: colors.border }]}
        >
          <SymbolView name={{ ios: "questionmark.circle", android: "help", web: "help" }} size={16} tintColor={colors.muted} />
          <Text style={[styles.helpLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>Get help with this sale</Text>
        </Pressable>
      ) : null}

      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Buyer</Text>
        {sale.buyer ? (
          <PartyProfileStrip
            party={sale.buyer}
            messageLabel="Message buyer"
            onMessage={
              sale.conversation_id
                ? () => router.push({ pathname: "/account/messages/[id]", params: { id: sale.conversation_id ?? "" } })
                : undefined
            }
          />
        ) : (
          <Text style={[styles.buyerName, { color: colors.foreground, fontFamily: fontFamily.text }]}>{sale.buyer_name}</Text>
        )}
        {sale.is_pickup && sale.address_lines.length === 0 ? (
          <Text style={[styles.verifyHint, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Local pickup. Coordinate a time and place with the buyer in messages.
          </Text>
        ) : null}
        {sale.review_from_buyer ? (
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {sale.buyer_name} rated you {sale.review_from_buyer.rating}/5
            {sale.review_from_buyer.comment ? ` — ${sale.review_from_buyer.comment}` : "."}
          </Text>
        ) : null}
      </View>

      {session?.access_token && sale.can_review ? (
        <OrderReviewSheet
          presented={reviewOpen}
          onDismiss={() => setReviewOpen(false)}
          onSubmitted={onVerified}
          accessToken={session.access_token}
          orderId={sale.id}
          subjectName={sale.buyer_name}
          subject="buyer"
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 16 },
  heading: { fontSize: 26, fontWeight: "700", letterSpacing: -0.4 },
  card: { borderRadius: 14, borderCurve: "continuous", padding: 16, gap: 12 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  itemImage: { width: 64, height: 64, borderRadius: 10, borderCurve: "continuous" },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  itemCopy: { flex: 1, minWidth: 0, gap: 1 },
  itemTitle: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  itemPrice: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 14, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  dlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dlRowLast: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 12 },
  dt: { fontSize: 14 },
  dd: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  orderNumber: { flexDirection: "row", alignItems: "center", gap: 6 },
  totalLabel: { fontSize: 14, fontWeight: "700" },
  totalValue: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  note: { fontSize: 12, lineHeight: 18 },
  refund: { fontSize: 12, fontWeight: "600" },
  statusKicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  statusLabel: { fontSize: 18, fontWeight: "700", lineHeight: 22 },
  statusDate: { fontSize: 14 },
  timelineBlock: { gap: 12 },
  timelineRow: { position: "relative", flexDirection: "row", gap: 12, paddingBottom: 16 },
  timelineLine: { position: "absolute", left: 5, top: 12, width: StyleSheet.hairlineWidth + 1, bottom: 0 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineCopy: { flex: 1, minWidth: 0 },
  timelineTitle: { fontSize: 14, fontWeight: "600" },
  timelineDate: { fontSize: 12, marginTop: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeOutline: { borderWidth: StyleSheet.hairlineWidth + 1, backgroundColor: "transparent" },
  badgeLabel: { fontSize: 13, fontWeight: "600" },
  address: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  addressCopy: { flex: 1, minWidth: 0 },
  addressKicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  addressName: { fontSize: 14, fontWeight: "700", textTransform: "uppercase" },
  track: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderCurve: "continuous", paddingHorizontal: 16, paddingVertical: 12 },
  trackLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  verifyCard: { borderWidth: 1, gap: 12 },
  verifyHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  verifyIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  verifyHint: { fontSize: 13, lineHeight: 18 },
  codeInput: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    letterSpacing: 4,
    fontWeight: "600",
  },
  verifyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  verifyButtonLabel: { fontSize: 15, fontWeight: "700" },
  helpButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  helpLabel: { fontSize: 14, fontWeight: "600" },
  block: { gap: 8, paddingTop: 4 },
  buyerName: { fontSize: 16, fontWeight: "700" },
  actionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
})
