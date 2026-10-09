import { SymbolView } from "expo-symbols"
import { StyleSheet, Text, View } from "react-native"
import type { MobileProfile, MobileReview } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

const STAR = "#EBB847"

export function ProfileFeedback({
  profile,
  reviews,
}: {
  profile: MobileProfile
  reviews: MobileReview[]
}) {
  const colors = useReswellColors()
  const asSeller = reviews.filter((review) => review.role === "seller")
  const asBuyer = reviews.filter((review) => review.role === "buyer")

  return (
    <View style={styles.panel}>
      {profile.review_count > 0 ? (
        <View style={styles.summary}>
          <Stars value={profile.rating_average} />
          <Text style={[styles.summaryScore, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {profile.rating_average.toFixed(1)}
          </Text>
          <Text style={[styles.summaryCount, { color: colors.muted, fontFamily: fontFamily.text }]}>
            · {profile.review_count} {profile.review_count === 1 ? "review" : "reviews"}
          </Text>
        </View>
      ) : null}
      <ReviewGroup title="Reviews as a seller" reviews={asSeller} empty="No reviews yet." />
      {asBuyer.length > 0 ? <ReviewGroup title="Reviews as a buyer" reviews={asBuyer} empty="No buyer reviews yet." /> : null}
    </View>
  )
}

export function ProfileInfo({ profile }: { profile: MobileProfile }) {
  const colors = useReswellColors()
  return (
    <View style={styles.panel}>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>About this seller</Text>
      {profile.about ? null : (
        <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
          This seller has not added a shop description yet.
        </Text>
      )}
      {profile.location_label ? (
        <View style={styles.row}>
          <SymbolView name={{ ios: "mappin", android: "location_on", web: "location_on" }} size={16} tintColor={colors.muted} />
          <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>{profile.location_label}</Text>
        </View>
      ) : null}
      <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Member since {profile.member_since_label}
      </Text>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Policies</Text>
      <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Purchases on Reswell are covered by buyer protection. Shipping, returns, and pickup details are set per listing. Message the seller with any questions before checkout.
      </Text>
    </View>
  )
}

function ReviewGroup({ title, reviews, empty }: { title: string; reviews: MobileReview[]; empty: string }) {
  const colors = useReswellColors()
  return (
    <View style={styles.group}>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
      {reviews.length === 0 ? (
        <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>{empty}</Text>
      ) : (
        reviews.map((review) => (
          <View key={review.id} style={[styles.review, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={styles.reviewTop}>
              <Text style={[styles.reviewer, { color: colors.foreground, fontFamily: fontFamily.text }]}>{review.reviewer_name}</Text>
              <Stars value={review.rating} />
              <Text style={[styles.date, { color: colors.muted, fontFamily: fontFamily.text }]}>{reviewDate(review.created_at)}</Text>
            </View>
            {review.comment ? (
              <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>{review.comment}</Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  )
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(value)
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <SymbolView
          key={star}
          name={{ ios: star <= filled ? "star.fill" : "star", android: star <= filled ? "star" : "star_border", web: "star" }}
          size={14}
          tintColor={STAR}
        />
      ))}
    </View>
  )
}

function reviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32, gap: 16 },
  summary: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryScore: { fontSize: 15, fontWeight: "600" },
  summaryCount: { fontSize: 15 },
  group: { gap: 12 },
  heading: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  body: { flex: 1, fontSize: 15, lineHeight: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  review: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 8 },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewer: { fontSize: 14, fontWeight: "600" },
  date: { marginLeft: "auto", fontSize: 12 },
  stars: { flexDirection: "row", gap: 2 },
})
