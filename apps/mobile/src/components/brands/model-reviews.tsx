import { StyleSheet, Text, View } from "react-native"
import type { MobileModelPage } from "@reswell/api-contract"
import { CatalogStars } from "@/components/brands/catalog-stars"
import { SCREEN_GUTTER } from "@/components/screen-shell"
import { fontFamily, useReswellColors } from "@/theme"

export function ModelReviews({ page }: { page: MobileModelPage }) {
  const colors = useReswellColors()
  return (
    <View style={styles.wrap}>
      {page.review_count > 0 ? (
        <View style={styles.summary}>
          <CatalogStars value={page.review_average} size={16} />
          <Text style={[styles.summaryText, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {page.review_average.toFixed(1)}
          </Text>
          <Text style={[styles.summaryCount, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {page.review_count} {page.review_count === 1 ? "review" : "reviews"}
          </Text>
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
          No reviews for the {page.name} yet.
        </Text>
      )}
      {page.reviews.map((review) => (
        <View key={review.id} style={[styles.review, { borderColor: colors.border }]}>
          <View style={styles.reviewHead}>
            <Text style={[styles.author, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {review.author_name}
            </Text>
            {review.created_label ? (
              <Text style={[styles.when, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {review.created_label}
              </Text>
            ) : null}
          </View>
          <CatalogStars value={review.rating} />
          {review.comment ? (
            <Text style={[styles.comment, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {review.comment}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 12, gap: 4 },
  summary: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 },
  summaryText: { fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },
  summaryCount: { fontSize: 14, fontWeight: "600" },
  empty: { fontSize: 15, lineHeight: 21, paddingVertical: 16 },
  review: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 14, gap: 8 },
  reviewHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  author: { flex: 1, fontSize: 15, fontWeight: "700" },
  when: { fontSize: 13 },
  comment: { fontSize: 15, lineHeight: 22 },
})
