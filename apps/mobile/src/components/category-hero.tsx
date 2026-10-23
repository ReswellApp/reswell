import { Image, type ImageContentPosition } from "expo-image"
import { StyleSheet, Text, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

function contentPosition(position: string | null): ImageContentPosition {
  if (!position) return "center"
  const [x, y] = position.split(" ")
  return {
    left: !x || x === "center" ? "50%" : x,
    top: !y || y === "center" ? "50%" : y,
  }
}

export function CategoryHero({
  title,
  imageUrl,
  imagePosition,
}: {
  title: string
  imageUrl: string | null
  imagePosition: string | null
}) {
  const colors = useReswellColors()
  if (!imageUrl) {
    return (
      <Text style={[styles.plainTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
    )
  }
  return (
    <View style={styles.frame}>
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        contentFit="cover"
        contentPosition={contentPosition(imagePosition)}
      />
      <View style={styles.shade} />
      <Text style={[styles.title, { fontFamily: fontFamily.headline }]}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    marginHorizontal: 16,
    marginTop: 8,
    height: 168,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  image: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  shade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.28)" },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.6,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  plainTitle: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.6,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
})
