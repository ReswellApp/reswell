import type { ReactElement, ReactNode } from "react"
import { ScrollView, StyleSheet, type RefreshControlProps, type StyleProp, type ViewStyle } from "react-native"

interface VerticalScrollProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  refreshControl?: ReactElement<RefreshControlProps>
  contentInsetAdjustmentBehavior?: "automatic" | "scrollableAxes" | "never" | "always"
}

/**
 * Page scroll. Horizontal rails are plain nested scroll views, so iOS and Android
 * pick the axis from the finger movement. A gesture arena here leaves the page
 * stuck after a swipe that starts on a rail.
 */
export function VerticalScroll({
  children,
  style,
  contentContainerStyle,
  refreshControl,
  contentInsetAdjustmentBehavior,
}: VerticalScrollProps) {
  return (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      refreshControl={refreshControl}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
}

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
      alwaysBounceHorizontal
      decelerationRate="normal"
      keyboardShouldPersistTaps="handled"
      style={styles.scroller}
      contentContainerStyle={contentStyle}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
})
