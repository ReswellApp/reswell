import { useCallback, useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { actOnShopify, fetchShopify } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountShopifyScreen() {
  const colors = useReswellColors()
  const { session } = useAuth()
  const load = useCallback((accessToken: string) => fetchShopify(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function run(body: Parameters<typeof actOnShopify>[1]) {
    const token = session?.access_token
    if (!token || pending) return
    setPending(true)
    setActionError(null)
    actOnShopify(token, body)
      .then(() => {
        setPublishingId(null)
        reload()
      })
      .catch((cause: unknown) => setActionError(cause instanceof Error ? cause.message : "Unable to update Shopify"))
      .finally(() => setPending(false))
  }

  return (
    <AccountState
      title="Shopify"
      loading={loading && !data}
      error={error}
      onRetry={reload}
      empty="Shopify is not available for this account."
      isEmpty={!data}
    >
      {data ? (
        <FlatList
          data={data.products}
          keyExtractor={(item) => item.id}
          refreshing={loading}
          onRefresh={reload}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                {data.shop_name || data.shop_domain || "Shopify"}
              </Text>
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{data.status_label}</Text>
              {data.message ? <Text style={[styles.meta, { color: colors.foreground, fontFamily: fontFamily.text }]}>{data.message}</Text> : null}
              {actionError ? <Text style={[styles.meta, { color: colors.destructive, fontFamily: fontFamily.text }]}>{actionError}</Text> : null}
            </View>
          }
          ListEmptyComponent={
            data.connected ? <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>No Shopify products yet.</Text> : null
          }
          renderItem={({ item }) => (
            <View>
              <AccountRow
                title={item.title}
                subtitle={item.selected ? item.section_label ?? "On Reswell" : "Not on Reswell"}
                meta={item.price_label}
                imageUrl={item.image_url}
                onPress={() => {
                  if (item.selected) run({ action: "unpublish", product_id: item.id })
                  else setPublishingId(item.id === publishingId ? null : item.id)
                }}
              />
              {publishingId === item.id ? (
                <View style={styles.sections}>
                  {data.sections.map((section) => (
                    <Pressable key={section.id} disabled={pending} onPress={() => run({ action: "publish", product_id: item.id, section: section.id })}>
                      <Text style={[styles.section, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}>
                        {section.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        />
      ) : null}
    </AccountState>
  )
}

const styles = StyleSheet.create({
  header: { padding: 20, gap: 6 },
  title: { fontSize: 28, fontWeight: "700" },
  meta: { fontSize: 15, lineHeight: 21 },
  empty: { textAlign: "center", padding: 24, fontSize: 15 },
  sections: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontWeight: "600" },
})