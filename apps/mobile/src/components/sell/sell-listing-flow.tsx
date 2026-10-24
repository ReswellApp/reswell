import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SymbolView } from "expo-symbols"
import { findBoardSpecField, SellBoardSpecs } from "@/components/sell/sell-board-specs"
import { SellDetailsStep } from "@/components/sell/sell-details-step"
import { SellOptionSheet } from "@/components/sell/sell-option-sheet"
import { SellPhotosStep } from "@/components/sell/sell-photos-step"
import { SellPlaceStep } from "@/components/sell/sell-place-step"
import { SellPriceStep } from "@/components/sell/sell-price-step"
import { SellProductStep } from "@/components/sell/sell-product-step"
import {
  fetchSellBoardSpecs,
  fetchSellTaxonomy,
  publishSellListing,
  saveSellListingDraft,
  uploadSellPhotos,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { clearSellDraft, loadSellDraft, saveSellDraft } from "@/lib/sell-draft"
import {
  defaultDeliveryForCategory,
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
  const [boardSpecPicker, setBoardSpecPicker] = useState<{ fieldId: string; decimals: boolean } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [busy, setBusy] = useState<"draft" | "post" | null>(null)
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
    if (!fulfillment || fulfillment.local_pickup) return
    setDraft((current) => {
      if (!current.localPickup && current.shipping) return current
      return { ...current, localPickup: false, shipping: true }
    })
  }, [fulfillment])

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
        Object.assign(merged, defaultDeliveryForCategory(next.category))
        merged.shippingMode = "reswell"
        merged.shippingPrice = ""
        merged.dropoffLocationId = ""
        merged.specs = {}
      }
      return merged
    })
  }

  async function saveDraft() {
    if (busy) return
    const token = session?.access_token
    if (!token) {
      try {
        await saveSellDraft(draft)
      } catch {
        // The account draft is what matters once they sign in.
      }
      router.push("/sign-in")
      return
    }
    if (!draft.category) {
      setNotice("Choose a category before saving a draft.")
      return
    }
    setBusy("draft")
    setNotice(null)
    try {
      const photos = await uploadSellPhotos(token, draft.photos)
      const saved = await saveSellListingDraft(token, { ...draft, photos })
      const next = { ...draft, photos, serverDraftId: saved.id }
      setDraft(next)
      await saveSellDraft(next)
      setDraftSaved(true)
      setNotice("Draft saved to your account.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't save this draft.")
    } finally {
      setBusy(null)
    }
  }

  async function postListing() {
    if (!ready || busy) return
    const token = session?.access_token
    if (!token) {
      router.push("/sign-in")
      return
    }
    setBusy("post")
    setNotice(null)
    try {
      const photos = await uploadSellPhotos(token, draft.photos)
      const published = await publishSellListing(token, { ...draft, photos })
      await clearSellDraft()
      router.replace(`/listing/${published.slug || published.id}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't publish this listing.")
      setBusy(null)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.foreground }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={8} style={styles.headerSide}>
          <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={22} tintColor={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          Sell an item
        </Text>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void saveDraft()} hitSlop={8} style={[styles.headerSide, styles.headerSideEnd]}>
          <Text style={[styles.draft, { color: draftSaved ? colors.muted : colors.foreground, fontFamily: fontFamily.text }]}>
            {busy === "draft" ? "Saving" : "Draft"}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
      >
        <Section>
          <SellPhotosStep photos={draft.photos} onChange={(photos) => patch({ photos })} />
        </Section>
        <Section>
          <SellProductStep
            draft={draft}
            taxonomy={taxonomy}
            error={taxonomyError}
            onRetry={loadTaxonomy}
            onChange={patch}
            variant="identity"
          />
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
            variant="classification"
            conditionLabel={conditionLabel || null}
            onConditionPress={() => setConditionOpen(true)}
          />
        </Section>
        {needsBoardSpecs ? (
          <Section title="Board specs">
            <SellBoardSpecs
              specs={boardSpecs}
              values={draft.specs}
              error={boardSpecsError}
              onRetry={() => setBoardSpecsAttempt((attempt) => attempt + 1)}
              onChange={(specs) => patch({ specs })}
              onOpenPicker={(fieldId, decimals) => setBoardSpecPicker({ fieldId, decimals })}
            />
          </Section>
        ) : null}
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
      <View style={[styles.footer, { borderTopColor: colors.foreground, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityRole="button"
          disabled={!ready || busy !== null}
          onPress={() => void postListing()}
          style={[styles.post, { backgroundColor: colors.foreground, opacity: ready && busy === null ? 1 : 0.35 }]}
        >
          <Text style={[styles.postLabel, { color: colors.background, fontFamily: fontFamily.text }]}>
            {busy === "post" ? "Posting…" : signedIn ? "Post listing" : "Sign in to publish"}
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
      {boardSpecPicker && boardSpecs ? (() => {
        const field = findBoardSpecField(boardSpecs, boardSpecPicker.fieldId)
        if (!field || field.kind !== "select") return null
        return (
          <SellOptionSheet
            title={field.label}
            options={field.options.map((option) => ({
              value: option.value,
              label:
                boardSpecPicker.decimals && option.decimal_label ? option.decimal_label : option.label,
            }))}
            selected={draft.specs[field.id] ?? ""}
            focusValue={field.focus_value}
            onSelect={(value) => {
              patch({ specs: { ...draft.specs, [field.id]: value } })
              setBoardSpecPicker(null)
            }}
            onClose={() => setBoardSpecPicker(null)}
          />
        )
      })() : null}
    </KeyboardAvoidingView>
  )
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  const colors = useReswellColors()
  return (
    <View style={[styles.section, { borderTopColor: colors.foreground }]}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
      ) : null}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { width: 72 },
  headerSideEnd: { alignItems: "flex-end" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  draft: { fontSize: 16, fontWeight: "700" },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 8 },
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
