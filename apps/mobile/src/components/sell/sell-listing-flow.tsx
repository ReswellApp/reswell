import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SymbolView } from "expo-symbols"
import { SellBoardSpecs } from "@/components/sell/sell-board-specs"
import { SellDetailsStep } from "@/components/sell/sell-details-step"
import { SellOptionSheet } from "@/components/sell/sell-option-sheet"
import { SellPhotosStep } from "@/components/sell/sell-photos-step"
import { SellPlaceStep } from "@/components/sell/sell-place-step"
import { SellPriceStep } from "@/components/sell/sell-price-step"
import { SellProductStep } from "@/components/sell/sell-product-step"
import { fetchSellBoardSpecs, fetchSellTaxonomy } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { loadSellDraft, saveSellDraft } from "@/lib/sell-draft"
import {
  emptySellDraft,
  SELL_CONDITIONS,
  sellConditionLabel,
  sellDraftIsReady,
  type SellDraft,
} from "@/lib/sell-flow"
import type { MobileSellBoardSpecs, MobileSellTaxonomy } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function SellListingFlow({ initial }: { initial?: Partial<SellDraft> }) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { session } = useAuth()
  const [draft, setDraft] = useState<SellDraft>(() => ({ ...emptySellDraft(), ...initial }))
  const [taxonomy, setTaxonomy] = useState<MobileSellTaxonomy | null>(null)
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null)
  const [boardSpecs, setBoardSpecs] = useState<MobileSellBoardSpecs | null>(null)
  const [boardSpecsError, setBoardSpecsError] = useState<string | null>(null)
  const [boardSpecsAttempt, setBoardSpecsAttempt] = useState(0)
  const [conditionOpen, setConditionOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const category = taxonomy?.categories.find((item) => item.slug === draft.category) ?? null
  const fulfillment = category?.fulfillment ?? null
  const needsBoardSpecs = category?.board_specs === true
  const specs = needsBoardSpecs ? boardSpecs : null
  const ready = sellDraftIsReady(draft, taxonomy?.categories ?? [], specs)
  const signedIn = Boolean(session?.access_token)
  const conditionLabel = draft.condition ? sellConditionLabel(draft.condition) : ""

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
    if (initial && Object.values(initial).some((value) => typeof value === "string" && value.length > 0)) return
    let cancelled = false
    loadSellDraft()
      .then((saved) => {
        if (!cancelled && saved) setDraft(saved)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

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
    setNotice(null)
    setDraftSaved(false)
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

  async function saveDraft() {
    try {
      await saveSellDraft(draft)
      setDraftSaved(true)
      setNotice("Draft saved on this phone.")
    } catch {
      setNotice("Couldn't save this draft.")
    }
  }

  function postListing() {
    if (!ready) return
    if (!signedIn) {
      router.push("/sign-in")
      return
    }
    setNotice("Publishing from the app isn’t connected yet. This listing stays on this screen.")
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={8} style={styles.headerSide}>
          <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={22} tintColor={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          Sell an item
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void saveDraft()} hitSlop={8} style={[styles.headerSide, styles.headerSideEnd]}>
          <Text style={[styles.draft, { color: draftSaved ? colors.muted : colors.foreground, fontFamily: fontFamily.text }]}>
            Draft
          </Text>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
        <Section title={`Add photos (up to 8)`}>
          <SellPhotosStep photos={draft.photos} onChange={(photos) => patch({ photos })} />
        </Section>
        <Section title="Description">
          <SellDetailsStep draft={draft} onChange={patch} showCondition={false} />
        </Section>
        <Section title="Info">
          <SellProductStep
            draft={draft}
            taxonomy={taxonomy}
            error={taxonomyError}
            onRetry={loadTaxonomy}
            onChange={patch}
          />
          {needsBoardSpecs ? (
            <SellBoardSpecs
              specs={boardSpecs}
              values={draft.specs}
              error={boardSpecsError}
              onRetry={() => setBoardSpecsAttempt((attempt) => attempt + 1)}
              onChange={(specs) => patch({ specs })}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => setConditionOpen(true)}
            style={[
              styles.condition,
              {
                backgroundColor: conditionLabel ? colors.foreground : colors.background,
                borderColor: colors.foreground,
              },
            ]}
          >
            {conditionLabel ? (
              <SymbolView name={{ ios: "checkmark", android: "check", web: "check" }} size={14} tintColor={colors.background} weight="bold" />
            ) : (
              <Text style={[styles.conditionPlus, { color: colors.foreground }]}>+</Text>
            )}
            <Text
              style={[
                styles.conditionLabel,
                { color: conditionLabel ? colors.background : colors.foreground, fontFamily: fontFamily.text },
              ]}
            >
              {conditionLabel || "Condition"}
            </Text>
          </Pressable>
        </Section>
        <Section title="Price">
          <SellPriceStep draft={draft} onChange={patch} />
        </Section>
        <Section title="Shipping">
          <SellPlaceStep
            draft={draft}
            fulfillment={fulfillment}
            categoryChosen={Boolean(draft.category)}
            taxonomyLoading={!taxonomy && !taxonomyError}
            taxonomyError={taxonomyError}
            onRetryTaxonomy={loadTaxonomy}
            onChange={patch}
          />
        </Section>
        {notice ? (
          <Text style={[styles.notice, { color: colors.muted, fontFamily: fontFamily.text }]}>{notice}</Text>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityRole="button"
          disabled={!ready}
          onPress={postListing}
          style={[styles.post, { backgroundColor: colors.foreground, opacity: ready ? 1 : 0.35 }]}
        >
          <Text style={[styles.postLabel, { color: colors.background, fontFamily: fontFamily.text }]}>
            {signedIn ? "Post listing" : "Sign in to publish"}
          </Text>
        </Pressable>
      </View>
      {conditionOpen ? (
        <SellOptionSheet
          title="Condition"
          selected={draft.condition}
          options={SELL_CONDITIONS}
          onSelect={(condition) => {
            patch({ condition })
            setConditionOpen(false)
          }}
          onClose={() => setConditionOpen(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useReswellColors()
  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: { width: 72 },
  headerSideEnd: { alignItems: "flex-end" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  draft: { fontSize: 16, fontWeight: "700" },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 8 },
  condition: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
  },
  conditionPlus: { fontSize: 16, fontWeight: "600" },
  conditionLabel: { fontSize: 15, fontWeight: "600" },
  section: { gap: 14, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  sectionTitle: { fontSize: 22, fontWeight: "700" },
  notice: { fontSize: 15, lineHeight: 21 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  post: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  postLabel: { fontSize: 16, fontWeight: "700" },
})
