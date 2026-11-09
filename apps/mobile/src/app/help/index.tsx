import { Stack, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileHelpHub } from "@reswell/api-contract"
import { SCREEN_GUTTER, ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { fetchHelpHub } from "@/lib/api"
import { helpArticleHref, helpTopicHref } from "@/lib/in-app-href"
import { fontFamily, useReswellColors } from "@/theme"

export default function HelpHubScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [page, setPage] = useState<MobileHelpHub | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(() => {
      fetchHelpHub(query)
        .then((next) => {
          if (!cancelled) {
            setPage(next)
            setError(null)
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load help")
        })
    }, query.trim() ? 200 : 0)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, attempt])

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Help Center" }} />
      {!page && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.foreground} />
        </View>
      ) : null}
      {error && !page ? (
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
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search help"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Search help"
            autoCorrect={false}
            returnKeyType="search"
            style={[
              styles.search,
              { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary },
            ]}
          />

          {query.trim() && page.results.length > 0 ? (
            <View style={styles.block}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                Results
              </Text>
              {page.results.map((article) => (
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

          {query.trim() && page.results.length === 0 ? (
            <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
              No articles match that search.
            </Text>
          ) : null}

          <View style={styles.block}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              Topics
            </Text>
            {page.topics.map((topic) => (
              <Pressable
                key={topic.id}
                onPress={() => router.push(helpTopicHref(topic.id))}
                style={[styles.card, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                  {topic.label}
                </Text>
                <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {topic.description}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.block}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              Popular articles
            </Text>
            {page.featured.map((article) => (
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
        </ScreenScroll>
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  page: { paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 32, gap: 20 },
  lead: { fontSize: 16, lineHeight: 22 },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, minHeight: 44, paddingHorizontal: 14, fontSize: 16 },
  block: { gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  card: { borderRadius: 16, padding: 14, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  retry: { fontSize: 15, fontWeight: "600" },
})
