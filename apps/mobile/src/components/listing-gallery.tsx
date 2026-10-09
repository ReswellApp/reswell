import { Image } from "expo-image"
import { useState } from "react"
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native"
import { useReswellColors } from "@/theme"

export function ListingGallery({ urls }: { urls: string[] }) {
  const colors = useReswellColors()
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const frames = urls.length > 0 ? urls : [null]

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width)
          setIndex(next)
        }}
      >
        {frames.map((uri, frame) =>
          uri ? (
            <Image
              key={uri}
              source={{ uri }}
              style={[styles.frame, { width, backgroundColor: colors.image }]}
              contentFit="cover"
            />
          ) : (
            <View key={frame} style={[styles.frame, { width, backgroundColor: colors.image }]} />
          ),
        )}
      </ScrollView>
      {frames.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          <View style={styles.dotsPill}>
            {frames.map((uri, frame) => (
              <View
                key={uri ?? frame}
                style={[styles.dot, { backgroundColor: frame === index ? "#FFFFFF" : "rgba(255,255,255,0.45)" }]}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 4 / 5 },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 14,
    alignItems: "center",
  },
  dotsPill: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(4,7,14,0.35)",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
