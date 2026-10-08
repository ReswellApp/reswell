import { Image } from "expo-image"
import { StyleSheet } from "react-native"
import { useReswellColors } from "@/theme"

const SOURCE = require("../../assets/images/reswell-logo.png")

export function Wordmark() {
  const colors = useReswellColors()
  const onDark = colors.background !== "#FFFFFF"
  return (
    <Image
      source={SOURCE}
      style={styles.mark}
      contentFit="contain"
      tintColor={onDark ? colors.foreground : undefined}
      accessibilityLabel="Reswell"
    />
  )
}

const styles = StyleSheet.create({
  mark: { width: 132, height: 22 },
})
