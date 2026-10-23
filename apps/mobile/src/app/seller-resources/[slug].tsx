import { Image } from "expo-image"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileSellerResource } from "@reswell/api-contract"
import { fetchSellerResource } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export default function SellerResourceScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const colors = useReswellColors()
  const router = useRouter()
  const [page, setPage] = useState<MobileSellerResource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setPage(null)
    setError(null)
    fetchSellerResource(slug)
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

  function openCard(screen: string | null, listingId: string | null) {
    if (listingId) {
      router.push({ pathname: "/listing/[id]", params: { id: listingId } })
      return
    }
    if (screen && screen !== slug) {
      router.push({ pathname: "/seller-resources/[slug]", params: { slug: screen } })
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: page?.title ?? "Seller Resources", headerShown: true }} />
      {!page && !error ? <ActivityIndicator color={colors.foreground} style={styles.center} /> : null}
      {error ? (
        <View style={styles.center}>
          <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>{error}</Text>
          <Pressable onPress={() => setAttempt((value) => value + 1)}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {page ? (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={[styles.description, { color: colors.muted, fontFamily: fontFamily.text }]}>{page.description}</Text>
          {page.sections.map((section, index) => (
            <View key={`${section.kind}-${section.title ?? index}`} style={styles.section}>
              {section.title ? (
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                  {section.title}
                </Text>
              ) : null}
              {section.kind === "paragraphs"
                ? section.paragraphs.map((paragraph) => (
                    <Text key={paragraph} style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                      {paragraph}
                    </Text>
                  ))
                : null}
              {section.kind === "steps"
                ? section.steps.map((step, stepIndex) => (
                    <View key={step.title} style={styles.step}>
                      <Text style={[styles.stepIndex, { color: colors.muted, fontFamily: fontFamily.text }]}>
                        {stepIndex + 1}
                      </Text>
                      <View style={styles.stepCopy}>
                        <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                          {step.title}
                        </Text>
                        <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>{step.body}</Text>
                      </View>
                    </View>
                  ))
                : null}
              {section.kind === "cards"
                ? section.cards.map((item) => {
                    const linked = Boolean(item.screen || item.listing_id)
                    return (
                      <Pressable
                        key={`${item.title}-${item.body}`}
                        disabled={!linked}
                        onPress={() => openCard(item.screen, item.listing_id)}
                        style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
                      >
                        {item.image_url ? (
                          <Image source={{ uri: item.image_url }} style={styles.image} contentFit="cover" />
                        ) : null}
                        <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                          {item.title}
                        </Text>
                        <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>{item.body}</Text>
                      </Pressable>
                    )
                  })
                : null}
              {section.kind === "faqs"
                ? section.items.map((item) => (
                    <View key={item.question} style={styles.stepCopy}>
                      <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                        {item.question}
                      </Text>
                      <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.answer}</Text>
                    </View>
                  ))
                : null}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  page: { padding: 20, paddingBottom: 48, gap: 28 },
  description: { fontSize: 16, lineHeight: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 22, lineHeight: 28 },
  body: { fontSize: 15, lineHeight: 22 },
  step: { flexDirection: "row", gap: 12 },
  stepIndex: { width: 22, fontSize: 15, lineHeight: 22 },
  stepCopy: { flex: 1, gap: 4 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 6 },
  cardTitle: { fontSize: 16, lineHeight: 22 },
  image: { width: "100%", height: 160, borderRadius: 12, marginBottom: 4 },
  retry: { fontSize: 15 },
})
