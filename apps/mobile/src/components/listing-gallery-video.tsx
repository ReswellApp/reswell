import { Image } from "expo-image"
import { useVideoPlayer, VideoView } from "expo-video"
import { useEffect } from "react"
import { StyleSheet, View } from "react-native"

const HERO_ASPECT = 3 / 4

/** One listing clip in the gallery. Pauses when the buyer swipes to a photo. */
export function ListingGalleryVideo({
  url,
  posterUrl,
  width,
  active,
}: {
  url: string
  posterUrl: string | null
  width: number
  active: boolean
}) {
  const player = useVideoPlayer(url, (next) => {
    next.loop = false
  })

  useEffect(() => {
    if (!active) player.pause()
  }, [active, player])

  return (
    <View style={[styles.frame, { width }]}>
      {posterUrl ? <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="contain" /> : null}
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        style={styles.video}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { aspectRatio: HERO_ASPECT, backgroundColor: "#000000" },
  poster: { ...StyleSheet.absoluteFillObject },
  video: { width: "100%", height: "100%" },
})
