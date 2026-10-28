import { SymbolView } from "expo-symbols"
import { useReswellColors } from "@/theme"

/** Same glyph + sizing as `CategoryToolbar` filter control. */
export const RESEWELL_FILTER_SYMBOL = {
  ios: "slider.horizontal.3",
  android: "tune",
  web: "tune",
} as const

/** Same glyph + sizing as `SearchCartHeader` inbox control (messages hub). */
export const RESEWELL_INBOX_SYMBOL = {
  ios: "bubble.left",
  android: "chat_bubble_outline",
  web: "chat_bubble_outline",
} as const

/** Inbox activity tab (saves, offers) — bell; header uses the message bubble for the full inbox. */
export const RESEWELL_INBOX_ACTIVITY_SYMBOL = {
  ios: "bell",
  android: "notifications",
  web: "notifications",
} as const

export function ReswellFilterIcon({ size = 20, tintColor }: { size?: number; tintColor?: string }) {
  const colors = useReswellColors()
  return <SymbolView name={RESEWELL_FILTER_SYMBOL} size={size} tintColor={tintColor ?? colors.foreground} />
}

export function ReswellInboxIcon({ size = 22, tintColor }: { size?: number; tintColor?: string }) {
  const colors = useReswellColors()
  return (
    <SymbolView
      name={RESEWELL_INBOX_SYMBOL}
      size={size}
      tintColor={tintColor ?? colors.foreground}
      weight="regular"
    />
  )
}

export function ReswellInboxActivityIcon({ size = 18, tintColor }: { size?: number; tintColor?: string }) {
  const colors = useReswellColors()
  return <SymbolView name={RESEWELL_INBOX_ACTIVITY_SYMBOL} size={size} tintColor={tintColor ?? colors.foreground} />
}
