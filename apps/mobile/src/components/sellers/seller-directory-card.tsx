import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileSellerCard } from "@reswell/api-contract"
import { ProfileCircle } from "@/components/profile-circle"
import { fontFamily, useReswellColors } from "@/theme"

const REVIEW_STAR = "#EAB308"
const MOSAIC_GAP = 3

function reviewCountLabel(count: number): string {
  return count === 1 ? "1" : String(count)
}

function SellerRatingStars({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)))
  return (
    <View style={styles.stars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 5 }, (_, index) => (
        <SymbolView
          key={index}
          name={{
            ios: index < filled ? "star.fill" : "star",
            android: "star",
            web: "star",
          }}
          size={11}
          tintColor={index < filled ? REVIEW_STAR : "#D1D5DB"}
        />
      ))}
    </View>
  )
}

/** Same grid as website `SellerDirectoryStorefrontMosaic`: hero left, two covers stacked right. */
function StorefrontMosaic({ imageUrls }: { imageUrls: string[] }) {
  const colors = useReswellColors()

  if (imageUrls.length === 0) {
    return <View style={[styles.mosaicEmpty, { backgroundColor: colors.image }]} />
  }

  if (imageUrls.length === 1) {
    return (
      <View style={styles.mosaicSingle}>
        <Image source={{ uri: imageUrls[0]! }} style={styles.mosaicFill} contentFit="cover" />
      </View>
    )
  }

  if (imageUrls.length === 2) {
    const [hero, stack] = imageUrls
    return (
      <View style={styles.mosaicTwo}>
        <View style={styles.mosaicHeroWide}>
          <Image source={{ uri: hero! }} style={styles.mosaicFill} contentFit="cover" />
        </View>
        <View style={styles.mosaicStackWide}>
          <Image source={{ uri: stack! }} style={styles.mosaicFill} contentFit="cover" />
        </View>
      </View>
    )
  }

  const [hero, second, third] = imageUrls
  return (
    <View style={styles.mosaicThree}>
      <View style={styles.mosaicHeroTall}>
        <Image source={{ uri: hero! }} style={styles.mosaicFill} contentFit="cover" />
      </View>
      <View style={styles.mosaicStackColumn}>
        <View style={styles.mosaicStackHalf}>
          <Image source={{ uri: second! }} style={styles.mosaicFill} contentFit="cover" />
        </View>
        <View style={styles.mosaicStackHalf}>
          <Image source={{ uri: third! }} style={styles.mosaicFill} contentFit="cover" />
        </View>
      </View>
    </View>
  )
}

export function SellerDirectoryCard({
  seller,
  following,
  followBusy,
  onPress,
  onPressFollow,
}: {
  seller: MobileSellerCard
  following: boolean
  followBusy: boolean
  onPress: () => void
  onPressFollow: () => void
}) {
  const colors = useReswellColors()
  const followLabel = following ? "Following" : "Follow"
  const metaBits = [seller.specialty_line, seller.inventory_line].filter(Boolean)
  const locationLine = seller.location
    ? `${seller.location}${seller.is_shop ? " · Shop" : ""}`
    : seller.is_shop
      ? "Shop"
      : "Seller"
  const showMeta = metaBits.length > 0 || seller.review_count > 0 || seller.offers_shipping

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.card },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.window}>
        <StorefrontMosaic imageUrls={seller.image_urls} />

        {seller.show_follow ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${followLabel} ${seller.name}`}
            disabled={followBusy}
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation()
              onPressFollow()
            }}
            style={({ pressed }) => [
              styles.followButton,
              {
                backgroundColor: "#FFFFFF",
                borderColor: colors.border,
                opacity: followBusy ? 0.6 : pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.followLabel,
                {
                  color: following ? colors.foreground : colors.shipping,
                  fontFamily: fontFamily.text,
                },
              ]}
            >
              {followLabel}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.identityRow} pointerEvents="none">
          <View style={styles.avatarRing}>
            <ProfileCircle url={seller.avatar_url} size={32} />
          </View>
          <View style={styles.identityCopy}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={[styles.name, { fontFamily: fontFamily.headline }]}>
                {seller.name}
              </Text>
              {seller.verified ? (
                <SymbolView
                  name={{ ios: "checkmark.seal.fill", android: "verified", web: "verified" }}
                  size={13}
                  tintColor="#7F9DD5"
                />
              ) : null}
            </View>
            <Text numberOfLines={1} style={[styles.subtitle, { fontFamily: fontFamily.text }]}>
              {locationLine}
            </Text>
          </View>
        </View>
      </View>

      {showMeta ? (
        <View style={styles.metaRow}>
          {metaBits.length > 0 ? (
            <Text numberOfLines={1} style={[styles.metaLine, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {metaBits.join(" · ")}
            </Text>
          ) : (
            <View style={styles.metaSpacer} />
          )}
          {seller.review_count > 0 ? (
            <View
              style={styles.ratingRow}
              accessibilityRole="text"
              accessibilityLabel={`${seller.rating_average.toFixed(1)} out of 5 stars, ${seller.review_count} reviews`}
            >
              <SellerRatingStars value={seller.rating_average} />
              <Text style={[styles.reviewCount, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {reviewCountLabel(seller.review_count)}
              </Text>
            </View>
          ) : null}
          {seller.offers_shipping ? (
            <View
              style={[styles.shipBadge, { backgroundColor: colors.secondary }]}
              accessibilityLabel={seller.shipping_line ?? "Ships"}
            >
              <SymbolView
                name={{ ios: "truck.box.fill", android: "local_shipping", web: "local_shipping" }}
                size={11}
                tintColor={colors.foreground}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  pressed: { opacity: 0.94 },
  window: { aspectRatio: 4 / 3, position: "relative", overflow: "hidden", backgroundColor: "#E5E7EB" },
  mosaicSingle: { ...StyleSheet.absoluteFillObject },
  mosaicEmpty: { ...StyleSheet.absoluteFillObject },
  mosaicTwo: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    gap: MOSAIC_GAP,
  },
  mosaicThree: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    gap: MOSAIC_GAP,
  },
  mosaicHeroWide: { flex: 1.2, overflow: "hidden" },
  mosaicStackWide: { flex: 0.8, overflow: "hidden" },
  mosaicHeroTall: { flex: 1.25, overflow: "hidden" },
  mosaicStackColumn: { flex: 0.75, gap: MOSAIC_GAP },
  mosaicStackHalf: { flex: 1, minHeight: 0, overflow: "hidden" },
  mosaicFill: { width: "100%", height: "100%" },
  followButton: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 3,
    minWidth: 84,
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  followLabel: { fontSize: 13, fontWeight: "700" },
  identityRow: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    zIndex: 2,
  },
  avatarRing: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    overflow: "hidden",
  },
  identityCopy: { flex: 1, minWidth: 0, paddingBottom: 1, gap: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  name: {
    flexShrink: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 11,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaLine: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: "600" },
  metaSpacer: { flex: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 0 },
  stars: { flexDirection: "row", alignItems: "center", gap: 0 },
  reviewCount: { fontSize: 11, fontVariant: ["tabular-nums"] },
  shipBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
})
