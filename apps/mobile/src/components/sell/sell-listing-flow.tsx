import { Stack, useRouter } from "expo-router"
import { useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SellDetailsStep } from "@/components/sell/sell-details-step"
import { SellPhotosStep } from "@/components/sell/sell-photos-step"
import { SellPlaceStep } from "@/components/sell/sell-place-step"
import { SellPriceStep } from "@/components/sell/sell-price-step"
import { SellReviewStep } from "@/components/sell/sell-review-step"
import { useAuth } from "@/lib/auth-context"
import {
  emptySellDraft,
  SELL_STEPS,
  SELL_STEP_TITLES,
  stepIsReady,
  type SellDraft,
  type SellSection,
} from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export function SellListingFlow({ section }: { section: SellSection }) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { session } = useAuth()
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<SellDraft>(emptySellDraft)
  const step = SELL_STEPS[stepIndex] ?? "photos"
  const ready = stepIsReady(step, draft)
  const signedIn = Boolean(session?.access_token)

  function patch(next: Partial<SellDraft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: SELL_STEP_TITLES[step] }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.progress, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {section.title} · {stepIndex + 1} of {SELL_STEPS.length}
        </Text>
        {step === "photos" ? <SellPhotosStep photos={draft.photos} onChange={(photos) => patch({ photos })} /> : null}
        {step === "details" ? <SellDetailsStep draft={draft} onChange={patch} /> : null}
        {step === "price" ? <SellPriceStep draft={draft} onChange={patch} /> : null}
        {step === "place" ? <SellPlaceStep draft={draft} onChange={patch} /> : null}
        {step === "review" ? <SellReviewStep section={section} draft={draft} signedIn={signedIn} /> : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        {stepIndex > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setStepIndex((current) => current - 1)} style={styles.back}>
            <Text style={[styles.backLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {step === "review" ? (
          signedIn ? null : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/sign-in")}
              style={[styles.continue, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.continueLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
                Sign in to publish
              </Text>
            </Pressable>
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={!ready}
            onPress={() => setStepIndex((current) => current + 1)}
            style={[styles.continue, { backgroundColor: colors.primary, opacity: ready ? 1 : 0.35 }]}
          >
            <Text style={[styles.continueLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              Continue
            </Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 16 },
  progress: { fontSize: 13, fontWeight: "600" },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  back: { minHeight: 48, justifyContent: "center", paddingHorizontal: 4 },
  backLabel: { fontSize: 16, fontWeight: "600" },
  continue: { borderRadius: 8, minHeight: 48, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  continueLabel: { fontSize: 16, fontWeight: "600" },
})
