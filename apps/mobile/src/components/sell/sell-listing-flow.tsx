import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SellDetailsStep } from "@/components/sell/sell-details-step"
import { SellPhotosStep } from "@/components/sell/sell-photos-step"
import { SellPlaceStep } from "@/components/sell/sell-place-step"
import { SellPriceStep } from "@/components/sell/sell-price-step"
import { SellProductStep } from "@/components/sell/sell-product-step"
import { SellReviewStep } from "@/components/sell/sell-review-step"
import { fetchSellBoardSpecs, fetchSellTaxonomy } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import {
  emptySellDraft,
  SELL_STEPS,
  SELL_STEP_TITLES,
  stepIsReady,
  type SellDraft,
} from "@/lib/sell-flow"
import type { MobileSellBoardSpecs, MobileSellTaxonomy } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function SellListingFlow({ initial }: { initial?: Partial<SellDraft> }) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { session } = useAuth()
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<SellDraft>(() => ({ ...emptySellDraft(), ...initial }))
  const [taxonomy, setTaxonomy] = useState<MobileSellTaxonomy | null>(null)
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null)
  const [boardSpecs, setBoardSpecs] = useState<MobileSellBoardSpecs | null>(null)
  const [boardSpecsError, setBoardSpecsError] = useState<string | null>(null)
  const [boardSpecsAttempt, setBoardSpecsAttempt] = useState(0)
  const step = SELL_STEPS[stepIndex] ?? "product"
  const category = taxonomy?.categories.find((item) => item.slug === draft.category) ?? null
  const fulfillment = category?.fulfillment ?? null
  const needsBoardSpecs = category?.board_specs === true
  const ready = stepIsReady(step, draft, taxonomy?.categories ?? [], needsBoardSpecs ? boardSpecs : null)
  const stepTitle = step === "place" && fulfillment ? fulfillment.title : SELL_STEP_TITLES[step]
  const signedIn = Boolean(session?.access_token)

  const loadTaxonomy = useCallback(() => {
    setTaxonomyError(null)
    fetchSellTaxonomy()
      .then(setTaxonomy)
      .catch((cause: unknown) => {
        setTaxonomyError(cause instanceof Error ? cause.message : "Unable to load categories")
      })
  }, [])

  useEffect(() => {
    loadTaxonomy()
  }, [loadTaxonomy])

  useEffect(() => {
    if (!needsBoardSpecs) return
    let cancelled = false
    setBoardSpecsError(null)
    fetchSellBoardSpecs()
      .then((result) => {
        if (!cancelled) setBoardSpecs(result)
      })
      .catch(() => {
        if (!cancelled) setBoardSpecsError("Couldn't load board details.")
      })
    return () => {
      cancelled = true
    }
  }, [needsBoardSpecs, boardSpecsAttempt])

  function patch(next: Partial<SellDraft>) {
    setDraft((current) => {
      const merged = { ...current, ...next }
      if (next.category && next.category !== current.category) {
        merged.shipping = true
        merged.localPickup = false
        merged.shippingMode = "reswell"
        merged.shippingPrice = ""
        merged.dropoffLocationId = ""
        merged.specs = {}
      }
      return merged
    })
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Sell" }} />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
        <Text style={[styles.progress, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Step {stepIndex + 1} of {SELL_STEPS.length}
        </Text>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          {stepTitle}
        </Text>
        {step === "place" && fulfillment ? (
          <Text style={[styles.stepDescription, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {fulfillment.description}
          </Text>
        ) : null}
        {step === "product" ? (
          <SellProductStep
            draft={draft}
            taxonomy={taxonomy}
            error={taxonomyError}
            onRetry={loadTaxonomy}
            onChange={patch}
          />
        ) : null}
        {step === "photos" ? (
          <SellPhotosStep
            photos={draft.photos}
            boardSpecs={needsBoardSpecs ? boardSpecs : undefined}
            specValues={draft.specs}
            specsError={boardSpecsError}
            onRetrySpecs={() => setBoardSpecsAttempt((attempt) => attempt + 1)}
            onChange={(photos) => patch({ photos })}
            onSpecsChange={(specs) => patch({ specs })}
          />
        ) : null}
        {step === "details" ? <SellDetailsStep draft={draft} onChange={patch} /> : null}
        {step === "price" ? <SellPriceStep draft={draft} onChange={patch} /> : null}
        {step === "place" ? <SellPlaceStep draft={draft} fulfillment={fulfillment} onChange={patch} /> : null}
        {step === "review" ? (
          <SellReviewStep draft={draft} taxonomy={taxonomy} boardSpecs={needsBoardSpecs ? boardSpecs : null} signedIn={signedIn} />
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        {stepIndex > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setStepIndex((current) => current - 1)}
            style={[styles.pill, styles.back, { backgroundColor: colors.background, borderColor: colors.border }]}
          >
            <Text style={[styles.pillLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Back</Text>
          </Pressable>
        ) : null}
        {step === "review" && signedIn ? null : (
          <Pressable
            accessibilityRole="button"
            disabled={step !== "review" && !ready}
            onPress={() => (step === "review" ? router.push("/sign-in") : setStepIndex((current) => current + 1))}
            style={[styles.pill, { backgroundColor: colors.listingHeart, opacity: step === "review" || ready ? 1 : 0.5 }]}
          >
            <Text style={[styles.pillLabel, { color: "#FFFFFF", fontFamily: fontFamily.text }]}>
              {step === "review" ? "Sign in to publish" : "Continue"}
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
  stepTitle: { fontSize: 28, fontWeight: "600", marginTop: -8 },
  stepDescription: { fontSize: 15, lineHeight: 21, marginTop: -8 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  back: { borderWidth: 1 },
  pillLabel: { fontSize: 16, fontWeight: "700" },
})
