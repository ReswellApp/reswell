import { Stack, useRouter } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileInfoPage } from "@reswell/api-contract"
import { SCREEN_GUTTER, ScreenFooter, ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { fetchInfoPage } from "@/lib/api"
import { pushInAppHref } from "@/lib/in-app-href"
import { fontFamily, useReswellColors } from "@/theme"

type Props = {
  slug: string
  eyebrow?: string
}

type CardItem = Extract<MobileInfoPage["sections"][number], { kind: "cards" }>["cards"][number]

export function InfoPageDocument({ slug, eyebrow }: Props) {
  const colors = useReswellColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [page, setPage] = useState<MobileInfoPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setPage(null)
    setError(null)
    fetchInfoPage(slug)
      .then((next) => {
        if (!cancelled) setPage(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this page")
      })
    return () => {
      cancelled = true
    }
  }, [slug, attempt])

  const hero = useMemo(() => {
    if (!page) return null
    const first = page.sections[0]
    if (first?.kind === "paragraphs" && first.title) {
      return { title: first.title, lead: first.paragraphs[0] ?? page.description, rest: page.sections.slice(1) }
    }
    return { title: page.title, lead: page.description, rest: page.sections }
  }, [page])

  function openCard(item: CardItem) {
    pushInAppHref(router, item.href)
  }

  function openCta() {
    if (!page?.cta_href || !pushInAppHref(router, page.cta_href)) {
      router.push("/account/support")
    }
  }

  const hasCta = Boolean(page?.cta_label)

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: page?.title ?? "Reswell", headerShown: true }} />
      {!page && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.foreground} />
        </View>
      ) : null}
      {error ? (
        <View style={styles.center}>
          <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>{error}</Text>
          <Pressable onPress={() => setAttempt((value) => value + 1)}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {page && hero ? (
        <>
          <ScreenScroll reserveFooter={hasCta} contentContainerStyle={styles.page}>
            <View style={[styles.hero, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.eyebrow, { color: colors.sellerProfileBannerDefault, fontFamily: fontFamily.text }]}>
                {eyebrow ?? "RESWELL"}
              </Text>
              <Text style={[styles.heroTitle, { color: colors.sold, fontFamily: fontFamily.headline }]}>
                {hero.title}
              </Text>
              <Text style={[styles.heroLead, { color: colors.muted, fontFamily: fontFamily.text }]}>{hero.lead}</Text>
            </View>

            {hero.rest.map((section, index) => (
              <View key={`${section.kind}-${section.title ?? index}`} style={styles.section}>
                {section.title ? (
                  <Text style={[styles.sectionTitle, { color: colors.sold, fontFamily: fontFamily.headline }]}>
                    {section.title}
                  </Text>
                ) : null}

                {section.kind === "paragraphs"
                  ? section.paragraphs.map((paragraph) => (
                      <Text
                        key={paragraph}
                        style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}
                      >
                        {paragraph}
                      </Text>
                    ))
                  : null}

                {section.kind === "steps"
                  ? section.steps.map((step, stepIndex) => (
                      <View key={step.title} style={[styles.stepCard, { backgroundColor: colors.secondary }]}>
                        <View style={[styles.stepBadge, { backgroundColor: colors.sold }]}>
                          <Text
                            style={[
                              styles.stepBadgeText,
                              { color: colors.primaryForeground, fontFamily: fontFamily.headline },
                            ]}
                          >
                            {stepIndex + 1}
                          </Text>
                        </View>
                        <View style={styles.stepCopy}>
                          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                            {step.title}
                          </Text>
                          <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
                            {step.body}
                          </Text>
                        </View>
                      </View>
                    ))
                  : null}

                {section.kind === "cards" ? (
                  <View style={styles.cardGrid}>
                    {section.cards.map((item) => (
                      <Pressable
                        key={`${item.title}-${item.body}`}
                        disabled={!item.href}
                        onPress={() => openCard(item)}
                        style={[styles.card, { backgroundColor: colors.secondary }]}
                      >
                        <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                          {item.title}
                        </Text>
                        {item.body ? (
                          <Text style={[styles.cardBodyText, { color: colors.muted, fontFamily: fontFamily.text }]}>
                            {item.body}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </ScreenScroll>
          {hasCta ? (
            <ScreenFooter style={{ borderColor: colors.border, backgroundColor: colors.background }}>
              <View style={[styles.footerInner, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <Pressable onPress={openCta} style={[styles.cta, { backgroundColor: colors.sold }]}>
                  <Text
                    style={[styles.ctaLabel, { color: colors.primaryForeground, fontFamily: fontFamily.headline }]}
                  >
                    {page.cta_label}
                  </Text>
                </Pressable>
              </View>
            </ScreenFooter>
          ) : null}
        </>
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  page: { gap: 28 },
  hero: { paddingHorizontal: SCREEN_GUTTER, paddingTop: 20, paddingBottom: 24, gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  heroTitle: { fontSize: 30, lineHeight: 34, fontWeight: "700" },
  heroLead: { fontSize: 16, lineHeight: 24 },
  section: { paddingHorizontal: SCREEN_GUTTER, gap: 12 },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  stepCard: { flexDirection: "row", gap: 12, borderRadius: 18, padding: 14 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepBadgeText: { fontSize: 13, fontWeight: "700" },
  stepCopy: { flex: 1, gap: 4 },
  cardGrid: { gap: 10 },
  card: { borderRadius: 18, padding: 14, gap: 6 },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  cardBodyText: { fontSize: 14, lineHeight: 20 },
  footerInner: { paddingHorizontal: SCREEN_GUTTER, paddingTop: 12 },
  cta: {
    borderRadius: 999,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  ctaLabel: { fontSize: 16, fontWeight: "700" },
  retry: { fontSize: 15, fontWeight: "600" },
})
