import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from "react"
import { ScrollView as NativeScrollView, StyleSheet, type RefreshControlProps, type StyleProp, type ViewStyle } from "react-native"
import { Gesture, GestureDetector, ScrollView, type NativeGesture } from "react-native-gesture-handler"

const ScrollNativeContext = createContext<NativeGesture | null>(null)

interface VerticalScrollProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  refreshControl?: ReactElement<RefreshControlProps>
  contentInsetAdjustmentBehavior?: "automatic" | "scrollableAxes" | "never" | "always"
}

/** Page scroll. Horizontal rails use this gesture so a vertical swipe still moves the page. */
export function VerticalScroll({
  children,
  style,
  contentContainerStyle,
  refreshControl,
  contentInsetAdjustmentBehavior,
}: VerticalScrollProps) {
  const native = useMemo(() => Gesture.Native(), [])
  return (
    <ScrollNativeContext.Provider value={native}>
      <GestureDetector gesture={native}>
        <ScrollView
          style={style}
          contentContainerStyle={contentContainerStyle}
          contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </GestureDetector>
    </ScrollNativeContext.Provider>
  )
}

/**
 * Native horizontal scroll: a flick keeps moving after you let go.
 * A vertical swipe fails this row and scrolls the page instead.
 */
export function HorizontalRail({
  children,
  contentStyle,
}: {
  children: ReactNode
  contentStyle?: StyleProp<ViewStyle>
}) {
  const pageGesture = useContext(ScrollNativeContext)
  const gesture = useMemo(() => {
    const scrolling = Gesture.Native()
    const vertical = Gesture.Pan().activeOffsetY([-10, 10]).failOffsetX([-8, 8])
    if (pageGesture) vertical.simultaneousWithExternalGesture(pageGesture)
    return Gesture.Exclusive(vertical, scrolling)
  }, [pageGesture])

  return (
    <GestureDetector gesture={gesture}>
      <NativeScrollView
        horizontal
        directionalLockEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        alwaysBounceHorizontal
        decelerationRate="normal"
        style={styles.scroller}
        contentContainerStyle={contentStyle}
      >
        {children}
      </NativeScrollView>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
})
