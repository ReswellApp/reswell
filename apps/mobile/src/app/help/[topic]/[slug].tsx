import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileHelpArticle } from "@reswell/api-contract"
import { SCREEN_GUTTER, ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { fetchHelpArticle } from "@/lib/api"
import { helpArticleHref } from "@/lib/in-app-href"
import { fontFamily, useReswellColors } from "@/theme"

export default function HelpArticleScreen() {
  const { topic, slug } = useLocalSearchParams<{ topic: string; slug: string }>()
  const colors = useReswellColors()
  const router = useRouter()
  const [page, setPage] = useState<MobileHelpArticle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setPage(null)
    setError(null)
    fetchHelpArticle(topic?.trim() ?? "", slug?.trim() ?? "")
      .then((next) => {
        if (!cancelled) setPage(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this article")
      })
    return () => {
      cancelled = true
    }
  }, [topic, slug, attempt])

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: page?.title ?? "Help" }} />
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
        <ScreenScroll contentContainerStyle={styles.page}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{page.title}</Text>
          {page.quick_answer ? (
            <View style={[styles.answer, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.kicker, { color: colors.muted, fontFamily: fontFamily.text }]}>QUICK ANSWER</Text>
              <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {page.quick_answer}
              </Text>
            </View>
          ) : null}
          {page.sections.map((section, index) => (
            <View key={`${section.heading ?? "section"}-${index}`} style={styles.block}>
              {section.heading ? (
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                  {section.heading}
                </Text>
              ) : null}
              <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>{section.text}</Text>
            </View>
          ))}
          {page.related.length > 0 ? (
            <View style={styles.block}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                Related
              </Text>
              {page.related.map((article) => (
                <Pressable
                  key={`${article.topic_id}/${article.slug}`}
                  onPress={() => router.push(helpArticleHref(article.topic_id, article.slug))}
                  style={[styles.row, { borderColor: colors.border }]}
                >
                  <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                    {article.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScreenScroll>
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  page: { paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 32, gap: 20 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: "700" },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  answer: { borderRadius: 16, padding: 14, gap: 8 },
  block: { gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 24 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  retry: { fontSize: 15, fontWeight: "600" },
})
