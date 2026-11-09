import { View } from "react-native"
import { SymbolView } from "expo-symbols"
import { useReswellColors } from "@/theme"

export function CatalogStars({ value, size = 13 }: { value: number; size?: number }) {
  const colors = useReswellColors()
  const filled = Math.max(0, Math.min(5, Math.round(value)))
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 1 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <SymbolView
          key={index}
          name={{
            ios: index < filled ? "star.fill" : "star",
            android: index < filled ? "star" : "star_border",
            web: "star",
          }}
          size={size}
          tintColor={index < filled ? colors.reviewStar : colors.border}
        />
      ))}
    </View>
  )
}
