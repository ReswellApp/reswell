import type { ReactNode } from "react"
import { Platform, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { horizontalRailContentStyle } from "@/components/screen-shell"

export { VerticalScroll, horizontalRailContentStyle, SCREEN_GUTTER } from "@/components/screen-shell"

/** Horizontal row. Momentum stays on the native scroller. A vertical swipe scrolls the page. */
export function HorizontalRail({
  children,
  contentStyle,
}: {
  children: ReactNode
  contentStyle?: StyleProp<ViewStyle>
}) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      alwaysBounceHorizontal={Platform.OS === "ios"}
      overScrollMode="always"
      decelerationRate="normal"
      keyboardShouldPersistTaps="handled"
      style={styles.scroller}
      contentContainerStyle={[horizontalRailContentStyle(), contentStyle]}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
})
