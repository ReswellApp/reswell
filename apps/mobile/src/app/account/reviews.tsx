import { SymbolView } from "expo-symbols"
import { FlatList, StyleSheet, Text, View } from "react-native"
import type { MobileReview } from "@reswell/api-contract"
import { AccountState } from "@/components/account-state"
import { fetchMyReviews } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

const STAR = "#EBB847"

export default function ReviewsScreen() {
  const { data, error, loading, reload } = useAccountResource(fetchMyReviews)
  const reviews = data?.reviews ?? []

  return (
    <AccountState
      title="Reviews"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No reviews yet."
      isEmpty={reviews.length === 0}
    >
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ReviewRow review={item} />}
      />
    </AccountState>
  )
}

function ReviewRow({ review }: { review: MobileReview }) {
  const colors = useReswellColors()
  const filled = Math.round(review.rating)
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.top}>
        <Text style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.text }]}>{review.reviewer_name}</Text>
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
      </View>
      <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {review.role === "seller" ? "As a seller" : "As a buyer"}
        {reviewDate(review.created_at) ? ` · ${reviewDate(review.created_at)}` : ""}
      </Text>
      {review.comment ? (
        <Text style={[styles.comment, { color: colors.foreground, fontFamily: fontFamily.text }]}>{review.comment}</Text>
      ) : null}
    </View>
  )
}

function reviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  row: { gap: 6, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  name: { flex: 1, fontSize: 16, fontWeight: "600" },
  stars: { flexDirection: "row", gap: 2 },
  meta: { fontSize: 13 },
  comment: { fontSize: 15, lineHeight: 21 },
})
