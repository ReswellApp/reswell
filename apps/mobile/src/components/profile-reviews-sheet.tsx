import { useEffect, useRef } from "react"
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileProfile, MobileReview } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

const SHEET_OFFSET = 520

export function ProfileBannerReviews({
  profile,
  onPress,
}: {
  profile: MobileProfile
  onPress: () => void
}) {
  const hasReviews = profile.review_count > 0
  if (!hasReviews) {
    return (
      <Text style={styles.bannerNoReviews} accessibilityRole="text">
        No reviews yet
      </Text>
    )
  }

  const label = `${profile.rating_average.toFixed(1)} out of 5, ${profile.review_count} ${
    profile.review_count === 1 ? "review" : "reviews"
  }`

  return (
    <Pressable
      onPress={onPress}
      style={styles.bannerReviews}
      accessibilityRole="button"
      accessibilityLabel={`${label}. View all reviews`}
    >
      <ReviewStars value={profile.rating_average} size={13} onDark />
      <Text style={styles.bannerScore}>{profile.rating_average.toFixed(1)}</Text>
      <Text style={styles.bannerCount}>
        ({profile.review_count} {profile.review_count === 1 ? "review" : "reviews"})
      </Text>
      <SymbolView
        name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
        size={12}
        tintColor="rgba(255, 255, 255, 0.75)"
      />
    </Pressable>
  )
}

export function ProfileReviewsSheet({
  profile,
  reviews,
  visible,
  onClose,
}: {
  profile: MobileProfile
  reviews: MobileReview[]
  visible: boolean
  onClose: () => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const closing = useRef(false)
  const translateY = useRef(new Animated.Value(SHEET_OFFSET)).current
  const backdrop = useRef(new Animated.Value(0)).current

  const asSeller = reviews.filter((review) => review.role === "seller")
  const asBuyer = reviews.filter((review) => review.role === "buyer")
  const title = `Reviews for ${profile.name}'s shop`

  useEffect(() => {
    if (!visible) {
      closing.current = false
      translateY.setValue(SHEET_OFFSET)
      backdrop.setValue(0)
      return
    }
    closing.current = false
    translateY.setValue(SHEET_OFFSET)
    backdrop.setValue(0)
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start()
  }, [backdrop, translateY, visible])

  function close() {
    if (closing.current) {
      onClose()
      return
    }
    closing.current = true
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SHEET_OFFSET, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      closing.current = false
      if (finished) onClose()
    })
    // If the close animation never completes (Modal inside scroll views), still dismiss.
    setTimeout(() => {
      if (closing.current) {
        closing.current = false
        onClose()
      }
    }, 260)
  }

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View pointerEvents="auto" style={[styles.scrim, { opacity: backdrop }]}>
          <Pressable accessibilityLabel="Dismiss reviews" style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, 16),
              maxHeight: "88%",
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.sheetTop}>
            <View style={styles.handle} />
            <Pressable
              accessibilityLabel="Close reviews"
              onPress={close}
              hitSlop={12}
              style={styles.close}
              pointerEvents="auto"
            >
              <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={16} tintColor={colors.foreground} />
            </Pressable>
          </View>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
          {profile.review_count > 0 ? (
            <View style={styles.summary}>
              <ReviewStars value={profile.rating_average} size={14} />
              <Text style={[styles.summaryScore, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {profile.rating_average.toFixed(1)}
              </Text>
              <Text style={[styles.summaryCount, { color: colors.muted, fontFamily: fontFamily.text }]}>
                · {profile.review_count} {profile.review_count === 1 ? "review" : "reviews"}
              </Text>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {reviews.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>No reviews yet.</Text>
            ) : (
              <>
                {asSeller.length > 0 ? (
                  <ReviewSection title="As a seller" reviews={asSeller} />
                ) : null}
                {asBuyer.length > 0 ? (
                  <ReviewSection title="As a buyer" reviews={asBuyer} />
                ) : null}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

function ReviewSection({ title, reviews }: { title: string; reviews: MobileReview[] }) {
  const colors = useReswellColors()
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
      {reviews.map((review, index) => (
        <View
          key={review.id}
          style={[styles.reviewRow, index > 0 ? { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}
        >
          <View style={styles.reviewHeader}>
            <Text style={[styles.reviewer, { color: colors.foreground, fontFamily: fontFamily.text }]} numberOfLines={1}>
              {review.reviewer_name}
            </Text>
            <Text style={[styles.reviewWhen, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {reviewTimeAgo(review.created_at)}
            </Text>
          </View>
          <ReviewStars value={review.rating} size={14} />
          {review.comment ? (
            <Text style={[styles.comment, { color: colors.foreground, fontFamily: fontFamily.text }]}>{review.comment}</Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}

function ReviewStars({ value, size, onDark }: { value: number; size: number; onDark?: boolean }) {
  const colors = useReswellColors()
  const filled = Math.round(value)
  const emptyTint = onDark ? "rgba(255, 255, 255, 0.35)" : colors.border
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <SymbolView
          key={star}
          name={{ ios: star <= filled ? "star.fill" : "star", android: star <= filled ? "star" : "star_border", web: "star" }}
          size={size}
          tintColor={star <= filled ? colors.reviewStar : emptyTint}
        />
      ))}
    </View>
  )
}

function reviewTimeAgo(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const styles = StyleSheet.create({
  bannerReviews: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  bannerNoReviews: { color: "rgba(255, 255, 255, 0.72)", fontSize: 13, fontWeight: "600", marginTop: 2 },
  bannerScore: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  bannerCount: { color: "rgba(255, 255, 255, 0.82)", fontSize: 13, fontWeight: "600" },
  overlay: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheet: {
    overflow: "hidden",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetTop: { alignItems: "center", paddingTop: 8, paddingHorizontal: 16 },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    marginBottom: 4,
    backgroundColor: "#C8C8C8",
  },
  close: {
    position: "absolute",
    top: 4,
    right: 12,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center", paddingHorizontal: 40, marginBottom: 8 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  summaryScore: { fontSize: 15, fontWeight: "600" },
  summaryCount: { fontSize: 15 },
  list: { paddingHorizontal: 20, paddingBottom: 8 },
  empty: { textAlign: "center", fontSize: 15, paddingVertical: 24 },
  section: { gap: 0, paddingTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "800", letterSpacing: 0.35, textTransform: "uppercase", marginBottom: 8 },
  reviewRow: { paddingVertical: 16, gap: 8 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewer: { flex: 1, fontSize: 15, fontWeight: "700" },
  reviewWhen: { fontSize: 13 },
  comment: { fontSize: 15, lineHeight: 22 },
  stars: { flexDirection: "row", gap: 2 },
})
