import { useState, type ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { fontFamily, useReswellColors } from "@/theme"

export function SellCollapsibleSection({
  title,
  subtitle,
  titleColor,
  badge,
  variant = "default",
  defaultExpanded = false,
  children,
}: {
  title: string
  subtitle?: string
  /** Defaults to foreground; use `listingHeart` for accent collapsibles. */
  titleColor?: string
  badge?: string
  /** Closed = brand blue nudge; open = white like the rest of the sell flow. */
  variant?: "default" | "promo" | "recommended"
  defaultExpanded?: boolean
  children: ReactNode
}) {
  const colors = useReswellColors()
  const [open, setOpen] = useState(defaultExpanded)
  const recommended = variant === "recommended"
  const promo = variant === "promo"

  const closedRecommended = recommended && !open
  const accent = closedRecommended
    ? "#FFFFFF"
    : titleColor ?? (promo && !open ? colors.listingHeart : colors.foreground)

  const cardStyle = closedRecommended
    ? { borderColor: colors.listingHeart, backgroundColor: colors.listingHeart }
    : promo && !open
      ? { borderColor: colors.listingHeart, backgroundColor: colors.protection }
      : { borderColor: colors.border, backgroundColor: colors.background }

  const subtitleColor = closedRecommended ? "rgba(255, 255, 255, 0.88)" : colors.muted

  return (
    <View style={[styles.card, cardStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={styles.header}
      >
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: accent, fontFamily: fontFamily.text }]}>{title}</Text>
            {badge && !open ? (
              <View
                style={[
                  styles.badge,
                  closedRecommended
                    ? { backgroundColor: "rgba(255, 255, 255, 0.22)" }
                    : { backgroundColor: colors.listingHeart },
                ]}
              >
                <Text
                  style={[
                    styles.badgeLabel,
                    {
                      fontFamily: fontFamily.text,
                      color: closedRecommended ? "#FFFFFF" : colors.primaryForeground,
                    },
                  ]}
                >
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          {subtitle && !open ? (
            <Text style={[styles.subtitle, { color: subtitleColor, fontFamily: fontFamily.text }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <SymbolView
          name={{
            ios: open ? "chevron.up" : "chevron.down",
            android: open ? "expand_less" : "expand_more",
            web: "expand_more",
          }}
          size={18}
          tintColor={accent}
          weight="semibold"
        />
      </Pressable>
      {open ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.body}>{children}</View>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  header: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", lineHeight: 22, flexShrink: 1 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  divider: { height: StyleSheet.hairlineWidth },
  body: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16, gap: 16 },
})
