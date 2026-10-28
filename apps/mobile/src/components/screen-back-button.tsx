import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { Pressable, type GestureResponderEvent } from "react-native"
import { useReswellColors } from "@/theme"

/** Chevron used by the search nav. */
export function ScreenBackButton({
  onPress,
  accessibilityLabel = "Back",
}: {
  onPress?: (event: GestureResponderEvent) => void
  accessibilityLabel?: string
}) {
  const colors = useReswellColors()
  const router = useRouter()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={(event) => {
        if (onPress) {
          onPress(event)
          return
        }
        router.back()
      }}
    >
      <SymbolView
        name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
        size={22}
        tintColor={colors.foreground}
      />
    </Pressable>
  )
}
