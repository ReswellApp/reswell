import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import type { ReactElement } from "react"
import { useFloatingTabBarContentInset } from "@/components/floating-tab-bar"

/** Horizontal inset for screen content and peek rails — keep one gutter everywhere. */
export const SCREEN_GUTTER = 16

/** Extra space below the last row when there is no sticky footer (tab screens include gap in tab inset). */
export const SCROLL_END_PADDING = 24

/** Minimum padding below the last row in compact option picker sheets. */
export const BOTTOM_SHEET_LIST_MIN_PADDING = 20

export function bottomSheetListPaddingBottom(safeAreaBottom: number): number {
  return Math.max(safeAreaBottom, BOTTOM_SHEET_LIST_MIN_PADDING)
}

/** Space between scroll content and a sticky footer (matches floating tab bar content gap). */
export const SCREEN_FOOTER_CONTENT_GAP = 12

const FOOTER_FALLBACK_HEIGHT = 88

type FooterHeightContextValue = {
  height: number
  setHeight: (height: number) => void
}

const FooterHeightContext = createContext<FooterHeightContextValue | null>(null)

/**
 * Root layout for full-bleed screens: flex column, optional sticky footer measured for scroll inset.
 *
 * ```tsx
 * <ScreenShell>
 *   <ScreenSearchHeader showBack />
 *   <ScreenScroll contentContainerStyle={styles.body}>…</ScreenScroll>
 *   <ScreenFooter bordered>
 *     <BuyBar />
 *   </ScreenFooter>
 * </ScreenShell>
 * ```
 */
export function ScreenShell({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [height, setHeightState] = useState(0)
  const setHeight = useCallback((next: number) => {
    setHeightState((current) => (current === next ? current : next))
  }, [])
  const value = useMemo(() => ({ height, setHeight }), [height, setHeight])
  return (
    <FooterHeightContext.Provider value={value}>
      <View style={[styles.shell, style]}>{children}</View>
    </FooterHeightContext.Provider>
  )
}

function useScreenFooterHeight(): number {
  const measured = useContext(FooterHeightContext)?.height ?? 0
  return measured > 0 ? measured : 0
}

/** Bottom padding so scroll content clears the floating tab bar (hidden on stack detail routes). */
export function useScreenTabBarInset(): ViewStyle {
  return useFloatingTabBarContentInset()
}

/** Bottom padding so scroll content clears a `ScreenFooter` plus a small content gap. */
export function useScreenFooterInset(): ViewStyle {
  const measured = useContext(FooterHeightContext)?.height ?? 0
  const footer = measured > 0 ? measured : FOOTER_FALLBACK_HEIGHT
  return { paddingBottom: footer + SCREEN_FOOTER_CONTENT_GAP }
}

function useScreenScrollInsets(options: { reserveFooter: boolean; endPadding: number }): ViewStyle {
  const tabBar = useFloatingTabBarContentInset()
  const footerMeasured = useScreenFooterHeight()
  const tabBottom = typeof tabBar.paddingBottom === "number" ? tabBar.paddingBottom : 0

  if (options.reserveFooter) {
    const footer = footerMeasured > 0 ? footerMeasured : FOOTER_FALLBACK_HEIGHT
    return { paddingBottom: footer + SCREEN_FOOTER_CONTENT_GAP }
  }

  const end = options.endPadding
  return tabBottom > 0 ? { paddingBottom: tabBottom } : end > 0 ? { paddingBottom: end } : {}
}

export type ScreenScrollProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  refreshControl?: ReactElement<RefreshControlProps>
  /**
   * iOS only. Use `never` when the screen uses a custom top chrome (search header) so UIKit
   * does not double-apply safe-area inset on the scroll view.
   */
  contentInsetAdjustmentBehavior?: "automatic" | "scrollableAxes" | "never" | "always"
  /** When true, adds inset for a sibling `ScreenFooter` (default true if footer is mounted). */
  reserveFooter?: boolean
  /** Trailing padding when there is no tab bar inset and no footer (default `SCROLL_END_PADDING`). */
  endPadding?: number
  showsVerticalScrollIndicator?: boolean
}

/**
 * Primary vertical scroller for app screens. Applies tab-bar and/or sticky-footer insets,
 * native rubber-banding on iOS, and nested horizontal rails without gesture conflicts.
 */
export function ScreenScroll({
  children,
  style,
  contentContainerStyle,
  refreshControl,
  contentInsetAdjustmentBehavior = "automatic",
  reserveFooter = false,
  endPadding = SCROLL_END_PADDING,
  showsVerticalScrollIndicator = false,
}: ScreenScrollProps) {
  const scrollInsets = useScreenScrollInsets({ reserveFooter, endPadding })
  return (
    <ScrollView
      style={[styles.scroll, style]}
      // Insets last so `paddingBottom` from callers cannot cover the sticky footer / tab bar.
      contentContainerStyle={[contentContainerStyle, scrollInsets]}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      refreshControl={refreshControl}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      alwaysBounceVertical={Platform.OS === "ios"}
      overScrollMode="always"
    >
      {children}
    </ScrollView>
  )
}

type ScreenFooterProps = {
  children: ReactNode
  bordered?: boolean
  style?: StyleProp<ViewStyle>
}

/** Sticky bottom chrome. Sits above the home indicator; reports height for `ScreenScroll` inset. */
export function ScreenFooter({ children, bordered = true, style }: ScreenFooterProps) {
  const setHeight = useContext(FooterHeightContext)?.setHeight
  useEffect(() => {
    return () => setHeight?.(0)
  }, [setHeight])
  return (
    <View
      onLayout={(event) => setHeight?.(event.nativeEvent.layout.height)}
      style={[
        styles.footer,
        bordered ? styles.footerBordered : null,
        style,
      ]}
    >
      {children}
    </View>
  )
}

/** Standard horizontal rail container: gutter, gap, end stop aligned with screen margin. */
export function horizontalRailContentStyle(gap = 12): ViewStyle {
  return {
    paddingHorizontal: SCREEN_GUTTER,
    gap,
    paddingRight: SCREEN_GUTTER,
  }
}

/** @deprecated Use `ScreenScroll` — kept for existing imports. */
export function VerticalScroll(props: ScreenScrollProps) {
  return <ScreenScroll {...props} />
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  scroll: { flex: 1 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  footerBordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})
