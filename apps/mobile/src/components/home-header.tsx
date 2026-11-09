import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SearchCartHeader } from "@/components/search-cart-header"
import { Wordmark } from "@/components/wordmark"
import { useReswellColors } from "@/theme"

/** Wordmark on its own row, then the search field, inbox, and cart beside each other. */
export function HomeHeader({ onCart, onInbox }: { onCart: () => void; onInbox: () => void }) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <View style={styles.mark}>
        <Wordmark />
      </View>
      <SearchCartHeader mode="open" onCart={onCart} onInbox={onInbox} insetTop={false} bordered={false} />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  mark: { alignItems: "center", justifyContent: "center", minHeight: 44 },
})
