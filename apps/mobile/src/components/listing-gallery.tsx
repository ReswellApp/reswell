import { Image } from "expo-image"
import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { ListingGalleryVideo } from "@/components/listing-gallery-video"
import { ListingImageLightbox } from "@/components/listing-image-lightbox"
import { fontFamily, useReswellColors } from "@/theme"

/** Same default frame as the website listing hero: 3:4, whole photo visible. */
const HERO_ASPECT = 3 / 4

export function ListingGallery({
  urls,
  video = null,
  sold = false,
  dimensionsLine = null,
}: {
  urls: string[]
  /** First playable clip, shown after the photos the way `/l` does. */
  video?: { url: string; posterUrl: string | null } | null
  sold?: boolean
  /** Same enlarge caption as the website, e.g. `5'11″ × 18 3/8″ × 2 1/4″ · 27 L`. */
  dimensionsLine?: string | null
}) {
  const colors = useReswellColors()
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const [enlarged, setEnlarged] = useState(false)
  const photos = urls.filter((url) => url.length > 0)
  const frames = photos.length > 0 || video ? photos.length + (video ? 1 : 0) : 1

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
        {Array.from({ length: frames }, (_, frame) => {
          const uri = photos[frame]
          if (uri) {
            return (
              <Pressable
                key={uri}
                accessibilityRole="button"
                accessibilityLabel="View enlarged photo"
                onPress={() => {
                  setIndex(frame)
                  setEnlarged(true)
                }}
              >
                <Image
                  source={{ uri }}
                  style={[styles.frame, { width, backgroundColor: colors.background }]}
                  contentFit="contain"
                />
              </Pressable>
            )
          }
          if (video && frame === photos.length) {
            return (
              <ListingGalleryVideo
                key={video.url}
                url={video.url}
                posterUrl={video.posterUrl}
                width={width}
                active={index === frame}
              />
            )
          }
          return <View key={frame} style={[styles.frame, { width, backgroundColor: colors.image }]} />
        })}
      </ScrollView>
      {sold ? (
        <View style={[styles.sold, { backgroundColor: colors.foreground }]} pointerEvents="none">
          <Text style={[styles.soldLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Sold</Text>
        </View>
      ) : null}
      {frames > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          <View style={styles.dotsPill}>
            {Array.from({ length: frames }, (_, frame) => (
              <View
                key={frame}
                style={[styles.dot, { backgroundColor: frame === index ? "#FFFFFF" : "rgba(255,255,255,0.45)" }]}
              />
            ))}
          </View>
        </View>
      ) : null}
      <ListingImageLightbox
        visible={enlarged}
        urls={photos}
        index={Math.min(index, Math.max(photos.length - 1, 0))}
        dimensionsLine={dimensionsLine ?? null}
        onIndexChange={setIndex}
        onClose={() => setEnlarged(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { aspectRatio: HERO_ASPECT },
  sold: {
    position: "absolute",
    top: 16,
    right: 16,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  soldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
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
