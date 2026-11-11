import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobilePurchaseReview } from "@reswell/api-contract"
import { submitOrderReview } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

const RATING_LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"] as const

function StarButton({
  filled,
  size,
  onPress,
  label,
}: {
  filled: boolean
  size: number
  onPress?: () => void
  label: string
}) {
  const colors = useReswellColors()
  const star = (
    <SymbolView
      name={{
        ios: filled ? "star.fill" : "star",
        android: filled ? "star" : "star_border",
        web: "star",
      }}
      size={size}
      tintColor={filled ? colors.reviewStar : colors.border}
    />
  )
  if (!onPress) {
    return <View accessibilityElementsHidden>{star}</View>
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      {star}
    </Pressable>
  )
}

export function ReviewStars({ value, size = 16 }: { value: number; size?: number }) {
  const filled = Math.round(Math.min(5, Math.max(0, value)))
  return (
    <View style={styles.starRow} accessibilityLabel={`${filled} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarButton key={star} filled={star <= filled} size={size} label={`${star} stars`} />
      ))}
    </View>
  )
}

export function ReviewPromptRow({
  existing,
  canReview,
  hidePrompt,
  actionLabel,
  waitingLabel,
  existingTitle,
  ratedYouLabel,
  onPress,
}: {
  existing: MobilePurchaseReview | null
  canReview: boolean
  hidePrompt: boolean
  actionLabel: string
  waitingLabel: string
  existingTitle: string
  ratedYouLabel?: string | null
  onPress: () => void
}) {
  const colors = useReswellColors()
  const card = { backgroundColor: colors.secondary }

  if (existing) {
    return (
      <View style={[styles.card, card]}>
        <Text style={[styles.existingTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          {existingTitle}
        </Text>
        <View style={styles.existingMeta}>
          <ReviewStars value={existing.rating} />
          <Text style={[styles.existingScore, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {existing.rating}/5
          </Text>
        </View>
        {existing.comment ? (
          <Text style={[styles.existingComment, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {existing.comment}
          </Text>
        ) : null}
      </View>
    )
  }

  if (hidePrompt) return ratedYouLabel ? <RatedYouNote label={ratedYouLabel} /> : null

  if (canReview) {
    return (
      <>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={[styles.card, styles.promptRow, card]}
        >
          <SymbolView
            name={{ ios: "star.fill", android: "star", web: "star" }}
            size={16}
            tintColor={colors.reviewStar}
          />
          <Text style={[styles.promptLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {actionLabel}
          </Text>
          <SymbolView
            name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
            size={16}
            tintColor={colors.muted}
          />
        </Pressable>
        {ratedYouLabel ? <RatedYouNote label={ratedYouLabel} /> : null}
      </>
    )
  }

  return (
    <>
      <View style={[styles.card, styles.promptRow, card]}>
        <SymbolView name={{ ios: "star", android: "star", web: "star" }} size={16} tintColor={colors.muted} />
        <Text style={[styles.waitingLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {actionLabel}
        </Text>
        <View accessible accessibilityRole="image" accessibilityLabel={waitingLabel}>
          <SymbolView
            name={{ ios: "info.circle", android: "info", web: "info" }}
            size={16}
            tintColor={colors.sellerProfileBannerDefault}
          />
        </View>
      </View>
      {ratedYouLabel ? <RatedYouNote label={ratedYouLabel} /> : null}
    </>
  )
}

function RatedYouNote({ label }: { label: string }) {
  const colors = useReswellColors()
  return (
    <Text style={[styles.ratedYou, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
  )
}

export function OrderReviewSheet({
  presented,
  onDismiss,
  onSubmitted,
  accessToken,
  orderId,
  subjectName,
  subject,
}: {
  presented: boolean
  onDismiss: () => void
  onSubmitted: () => void
  accessToken: string
  orderId: string
  subjectName: string
  subject: "seller" | "buyer"
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!presented) {
      setRating(5)
      setComment("")
      setBusy(false)
      setError(null)
    }
  }, [presented])

  function close() {
    if (busy) return
    onDismiss()
  }

  function submit() {
    if (busy || rating < 1) return
    setBusy(true)
    setError(null)
    void submitOrderReview(accessToken, orderId, {
      rating,
      comment: comment.trim() || undefined,
    })
      .then(() => {
        onDismiss()
        onSubmitted()
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not save your review")
        setBusy(false)
      })
  }

  const caption = RATING_LABELS[rating - 1] ?? "Excellent"
  const hint =
    subject === "buyer"
      ? "Rate this buyer for this completed sale. You can submit one review per order."
      : "Rate your experience for this purchase. You can submit one review per order; it appears on their profile."

  return (
    <Modal visible={presented} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView
        style={[styles.sheet, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            Review {subjectName}
          </Text>
          <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>{hint}</Text>

          <View style={styles.ratingBlock}>
            <Text style={[styles.sectionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              Rating
            </Text>
            <View style={styles.pickerRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <StarButton
                  key={star}
                  filled={star <= rating}
                  size={36}
                  onPress={() => setRating(star)}
                  label={`${star} star${star === 1 ? "" : "s"}`}
                />
              ))}
            </View>
            <Text style={[styles.caption, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {caption} · {rating}/5
            </Text>
          </View>

          <View style={styles.commentBlock}>
            <Text style={[styles.sectionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              Written review (optional)
            </Text>
            <TextInput
              value={comment}
              onChangeText={(value) => setComment(value.slice(0, 2000))}
              placeholder={
                subject === "buyer"
                  ? "Optional — communication, pickup, or payment."
                  : "Optional. A quick note helps other buyers."
              }
              placeholderTextColor={colors.muted}
              multiline
              maxLength={2000}
              style={[
                styles.comment,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                  fontFamily: fontFamily.text,
                },
              ]}
            />
            <Text style={[styles.counter, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {comment.length}/2000
            </Text>
          </View>

          {error ? (
            <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Post review"
            style={[styles.primary, { backgroundColor: colors.foreground, opacity: busy ? 0.7 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[styles.primaryLabel, { color: colors.background, fontFamily: fontFamily.text }]}>
                Post review
              </Text>
            )}
          </Pressable>
          <Pressable onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={[styles.cancel, { color: colors.muted, fontFamily: fontFamily.text }]}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderCurve: "continuous", padding: 16, gap: 8 },
  promptRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  promptLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  waitingLabel: { flex: 1, fontSize: 14 },
  existingTitle: { fontSize: 14, fontWeight: "600" },
  existingMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  existingScore: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  existingComment: { fontSize: 14, lineHeight: 20 },
  ratedYou: { fontSize: 14, lineHeight: 20 },
  starRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  sheet: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, gap: 18 },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.4 },
  hint: { fontSize: 15, lineHeight: 22 },
  ratingBlock: { gap: 8 },
  sectionLabel: { fontSize: 15, fontWeight: "600" },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  caption: { fontSize: 14 },
  commentBlock: { gap: 8 },
  comment: {
    minHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },
  counter: { fontSize: 12, textAlign: "right" },
  error: { fontSize: 14 },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },
  cancel: { fontSize: 15, textAlign: "center", paddingVertical: 8 },
})
