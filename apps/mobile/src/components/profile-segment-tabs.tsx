import { Pressable, StyleSheet, Text, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

export function ProfileSegmentTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={[styles.track, { backgroundColor: colors.secondary }]}>
      {tabs.map((tab) => {
        const selected = tab.id === active
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={[
              styles.item,
              selected ? { backgroundColor: colors.background, shadowColor: colors.foreground } : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color: selected ? colors.foreground : colors.muted,
                  fontFamily: fontFamily.text,
                  fontWeight: selected ? "700" : "600",
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  label: { fontSize: 14 },
})
