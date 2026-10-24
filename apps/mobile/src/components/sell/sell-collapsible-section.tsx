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
  /** Tinted nudge surface — reads as a tip, not another required field. */
  variant?: "default" | "promo"
  defaultExpanded?: boolean
  children: ReactNode
}) {
  const colors = useReswellColors()
  const [open, setOpen] = useState(defaultExpanded)
  const accent = titleColor ?? colors.foreground
  const promo = variant === "promo"

  return (
    <View
      style={[
        styles.card,
        promo
          ? { borderColor: colors.listingHeart, backgroundColor: colors.protection }
          : { borderColor: colors.foreground, backgroundColor: colors.background },
      ]}
    >
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
              <View style={[styles.badge, { backgroundColor: colors.listingHeart }]}>
                <Text style={[styles.badgeLabel, { fontFamily: fontFamily.text }]}>{badge}</Text>
              </View>
            ) : null}
          </View>
          {subtitle && !open ? (
            <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]} numberOfLines={2}>
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
          <View style={[styles.divider, { backgroundColor: promo ? colors.listingHeart : colors.border, opacity: promo ? 0.2 : 1 }]} />
          <View style={[styles.body, promo ? { backgroundColor: colors.protection } : null]}>{children}</View>
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
  badgeLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  divider: { height: StyleSheet.hairlineWidth },
  body: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16, gap: 16 },
})
