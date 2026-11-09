import { Image } from "expo-image"
import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileSellerResource } from "@reswell/api-contract"
import {
  SCREEN_GUTTER,
  ScreenFooter,
  ScreenScroll,
  ScreenShell,
} from "@/components/screen-shell"
import { useAuth } from "@/lib/auth-context"
import { fetchSellerResource } from "@/lib/api"
import { pushInAppHref } from "@/lib/in-app-href"
import { fontFamily, useReswellColors } from "@/theme"

type Props = {
  slug: string
}

type CardItem = Extract<MobileSellerResource["sections"][number], { kind: "cards" }>["cards"][number]

function sellerSlugFromHref(href: string | null | undefined): string | null {
  if (!href) return null
  const match = href.match(/^\/sellers\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function listingIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null
  const match = href.match(/^\/(?:listings?|l)\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function heroBlock(page: MobileSellerResource): { title: string; lead: string } {
  const first = page.sections[0]
  if (first?.kind === "paragraphs" && first.title) {
    return { title: first.title, lead: first.paragraphs[0] ?? page.description }
  }
  return { title: page.title, lead: page.description }
}

/** Drop the first paragraphs section when it is already rendered as the hero. */
function bodySections(page: MobileSellerResource): MobileSellerResource["sections"] {
  const first = page.sections[0]
  if (first?.kind === "paragraphs" && first.title) {
    return page.sections.slice(1)
  }
  return page.sections
}

export function SellerResourceDocument({ slug }: Props) {
  const colors = useReswellColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session } = useAuth()
  const accessToken = session?.access_token ?? null
  const [page, setPage] = useState<MobileSellerResource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPage(null)
    setError(null)
    setOpenFaq(null)
    fetchSellerResource(slug, accessToken)
      .then((next) => {
        if (!cancelled) setPage(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this page")
      })
    return () => {
      cancelled = true
    }
  }, [slug, attempt, accessToken])

  const sections = useMemo(() => (page ? bodySections(page) : []), [page])
  const hero = useMemo(() => (page ? heroBlock(page) : null), [page])

  const openHref = useCallback(
    (href: string | null | undefined) => {
      if (!href) return
      const sellerSlug = sellerSlugFromHref(href)
      if (sellerSlug) {
        router.push({ pathname: "/sellers/[slug]", params: { slug: sellerSlug } })
        return
      }
      const listingId = listingIdFromHref(href)
      if (listingId) {
        router.push({ pathname: "/listing/[id]", params: { id: listingId } })
        return
      }
      if (href === "/sell" || href.startsWith("/sell/")) {
        router.push("/sell/new")
        return
      }
      pushInAppHref(router, href)
    },
    [router],
  )

  function openCard(item: CardItem) {
    if (item.listing_id) {
      router.push({ pathname: "/listing/[id]", params: { id: item.listing_id } })
      return
    }
    if (item.screen && item.screen !== slug) {
      router.push({ pathname: "/seller-resources/[slug]", params: { slug: item.screen } })
      return
    }
    openHref(item.href)
  }

  function openCta() {
    if (!page?.cta_href) {
      router.push("/sell/new")
      return
    }
    openHref(page.cta_href)
  }

  const hasCta = Boolean(page?.cta_label)

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: page?.title ?? "Seller Resources", headerShown: true }} />
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
      {page ? (
        <>
          <ScreenScroll reserveFooter={hasCta} contentContainerStyle={styles.page}>
            <View style={[styles.hero, { backgroundColor: colors.secondary }]}>
              <Text
                style={[styles.eyebrow, { color: colors.sellerProfileBannerDefault, fontFamily: fontFamily.text }]}
              >
                SELLER RESOURCES
              </Text>
              <Text style={[styles.heroTitle, { color: colors.sold, fontFamily: fontFamily.headline }]}>
                {hero?.title}
              </Text>
              <Text style={[styles.heroLead, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {hero?.lead}
              </Text>
            </View>

            {sections.map((section, index) => (
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
                      <View
                        key={step.title}
                        style={[styles.stepCard, { backgroundColor: colors.secondary }]}
                      >
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
                          <Text
                            style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}
                          >
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
                    {section.cards.map((item) => {
                      const linked = Boolean(item.screen || item.listing_id || item.href)
                      const photoCard = Boolean(item.image_url)
                      return (
                        <Pressable
                          key={`${item.title}-${item.body}`}
                          disabled={!linked}
                          onPress={() => openCard(item)}
                          style={[
                            styles.card,
                            photoCard ? styles.photoCard : null,
                            { backgroundColor: colors.secondary },
                          ]}
                        >
                          {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.image} contentFit="cover" />
                          ) : null}
                          <View style={styles.cardBody}>
                            <View style={styles.cardTitleRow}>
                              <Text
                                style={[
                                  styles.cardTitle,
                                  { color: colors.foreground, fontFamily: fontFamily.headline, flex: 1 },
                                ]}
                              >
                                {item.title}
                              </Text>
                              {item.badge ? (
                                <View
                                  style={[
                                    styles.badge,
                                    { backgroundColor: `${colors.sellerProfileBannerDefault}1A` },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.badgeText,
                                      {
                                        color: colors.sellerProfileBannerDefault,
                                        fontFamily: fontFamily.text,
                                      },
                                    ]}
                                  >
                                    {item.badge}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            {item.body ? (
                              <Text style={[styles.cardBodyText, { color: colors.muted, fontFamily: fontFamily.text }]}>
                                {item.body}
                              </Text>
                            ) : null}
                            {linked ? (
                              <Text
                                style={[
                                  styles.cardLink,
                                  { color: colors.sellerProfileBannerDefault, fontFamily: fontFamily.text },
                                ]}
                              >
                                Open →
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      )
                    })}
                  </View>
                ) : null}

                {section.kind === "faqs"
                  ? section.items.map((item) => {
                      const open = openFaq === item.question
                      return (
                        <Pressable
                          key={item.question}
                          onPress={() => setOpenFaq(open ? null : item.question)}
                          style={[styles.faqRow, { borderColor: colors.border }]}
                        >
                          <View style={styles.faqHeader}>
                            <Text
                              style={[
                                styles.cardTitle,
                                { color: colors.foreground, fontFamily: fontFamily.headline, flex: 1 },
                              ]}
                            >
                              {item.question}
                            </Text>
                            <Text style={{ color: colors.muted, fontFamily: fontFamily.text }}>
                              {open ? "−" : "+"}
                            </Text>
                          </View>
                          {open ? (
                            <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
                              {item.answer}
                            </Text>
                          ) : null}
                        </Pressable>
                      )
                    })
                  : null}
              </View>
            ))}
          </ScreenScroll>

          {hasCta ? (
            <ScreenFooter style={{ borderColor: colors.border, backgroundColor: colors.background }}>
              <View style={[styles.footerInner, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <Pressable
                  onPress={openCta}
                  style={[styles.cta, { backgroundColor: colors.sold }]}
                >
                  <Text
                    style={[
                      styles.ctaLabel,
                      { color: colors.primaryForeground, fontFamily: fontFamily.headline },
                    ]}
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
  hero: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 10,
  },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  heroTitle: { fontSize: 30, lineHeight: 34, fontWeight: "700" },
  heroLead: { fontSize: 16, lineHeight: 24 },
  section: { paddingHorizontal: SCREEN_GUTTER, gap: 12 },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  stepCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    padding: 14,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: { fontSize: 13, fontWeight: "700" },
  stepCopy: { flex: 1, gap: 4 },
  cardGrid: { gap: 10 },
  card: { borderRadius: 18, overflow: "hidden" },
  photoCard: {},
  image: { width: "100%", height: 168 },
  cardBody: { padding: 14, gap: 6 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  cardBodyText: { fontSize: 14, lineHeight: 20 },
  cardLink: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  faqRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    gap: 8,
  },
  faqHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
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
