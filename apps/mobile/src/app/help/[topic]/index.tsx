import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileHelpTopic } from "@reswell/api-contract"
import { SCREEN_GUTTER, ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { fetchHelpTopic } from "@/lib/api"
import { helpArticleHref } from "@/lib/in-app-href"
import { fontFamily, useReswellColors } from "@/theme"

export default function HelpTopicScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>()
  const colors = useReswellColors()
  const router = useRouter()
  const [page, setPage] = useState<MobileHelpTopic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setPage(null)
    setError(null)
    fetchHelpTopic(topic?.trim() ?? "")
      .then((next) => {
        if (!cancelled) setPage(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this topic")
      })
    return () => {
      cancelled = true
    }
  }, [topic, attempt])

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: page?.label ?? "Help" }} />
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
          <Text style={[styles.lead, { color: colors.muted, fontFamily: fontFamily.text }]}>{page.description}</Text>
          {page.sections.map((section) => (
            <View key={section.title} style={styles.block}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                {section.title}
              </Text>
              {section.groups.map((group) => (
                <View key={group.title} style={styles.group}>
                  <Text style={[styles.groupTitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
                    {group.title}
                  </Text>
                  {group.articles.map((article) => (
                    <Pressable
                      key={article.slug}
                      onPress={() => router.push(helpArticleHref(article.topic_id, article.slug))}
                      style={[styles.row, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                        {article.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </ScreenScroll>
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  page: { paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 32, gap: 24 },
  lead: { fontSize: 16, lineHeight: 22 },
  block: { gap: 12 },
  sectionTitle: { fontSize: 22, fontWeight: "700" },
  group: { gap: 4 },
  groupTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  retry: { fontSize: 15, fontWeight: "600" },
})
