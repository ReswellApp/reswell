import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { useEffect, useRef, useState } from "react"
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { fontFamily, useReswellColors } from "@/theme"

const MIN_SCALE = 1
const MAX_SCALE = 4

/** Enlarged listing photos. Swipe between frames, pinch to zoom, chrome matches the website. */
export function ListingImageLightbox({
  visible,
  urls,
  index,
  dimensionsLine,
  onIndexChange,
  onClose,
}: {
  visible: boolean
  urls: string[]
  index: number
  dimensionsLine: string | null
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const listRef = useRef<FlatList<string>>(null)
  const thumbsRef = useRef<ScrollView>(null)
  const indexRef = useRef(index)
  const [stageWidth, setStageWidth] = useState(windowWidth)
  const [stageHeight, setStageHeight] = useState(windowWidth)
  const [zoomed, setZoomed] = useState(false)
  indexRef.current = index

  useEffect(() => {
    setZoomed(false)
  }, [index])

  useEffect(() => {
    if (!visible) return
    const frame = Math.max(0, Math.min(indexRef.current, urls.length - 1))
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: frame, animated: false })
    })
  }, [visible, stageWidth, urls.length])

  useEffect(() => {
    thumbsRef.current?.scrollTo({ x: Math.max(0, index * 54 - stageWidth / 2), animated: true })
  }, [index, stageWidth])

  function settle(offsetX: number) {
    const next = Math.round(offsetX / Math.max(stageWidth, 1))
    if (next === indexRef.current || next < 0 || next >= urls.length) return
    onIndexChange(next)
  }

  function goTo(next: number) {
    if (urls.length === 0) return
    const frame = (next + urls.length) % urls.length
    listRef.current?.scrollToIndex({ index: frame, animated: true })
    onIndexChange(frame)
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.image }]}>
        <View style={[styles.toolbar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={[styles.close, { backgroundColor: colors.background, borderColor: colors.border }]}
          >
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} tintColor={colors.foreground} />
          </Pressable>
        </View>
        <View
          style={styles.stage}
          onLayout={(event) => {
            setStageWidth(event.nativeEvent.layout.width)
            setStageHeight(event.nativeEvent.layout.height)
          }}
        >
          <FlatList
            ref={listRef}
            data={urls}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            bounces={urls.length > 1}
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(uri, frame) => `${uri}-${frame}`}
            initialScrollIndex={urls.length > 0 ? Math.min(index, urls.length - 1) : 0}
            getItemLayout={(_, frame) => ({ length: stageWidth, offset: stageWidth * frame, index: frame })}
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({ offset: stageWidth * info.index, animated: false })
            }}
            onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}
            onScrollEndDrag={(event) => {
              if (Math.abs(event.nativeEvent.velocity?.x ?? 0) < 0.05) settle(event.nativeEvent.contentOffset.x)
            }}
            renderItem={({ item, index: frame }) => (
              <ZoomablePhoto
                uri={item}
                width={stageWidth}
                height={stageHeight}
                active={frame === index}
                onZoomedChange={setZoomed}
              />
            )}
          />
        </View>
        {dimensionsLine || urls.length > 1 ? (
          <View
            style={[
              styles.chrome,
              {
                backgroundColor: colors.image,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            {dimensionsLine ? (
              <Text style={[styles.dimensions, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {dimensionsLine}
              </Text>
            ) : null}
            {urls.length > 1 ? (
              <View style={styles.navRow}>
                <ChromeButton label="Previous photo" name="chevron.left" onPress={() => goTo(index - 1)} />
                <ScrollView
                  ref={thumbsRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbs}
                  style={styles.thumbScroller}
                >
                  {urls.map((url, thumb) => {
                    const selected = thumb === index
                    return (
                      <Pressable
                        key={`${url}-${thumb}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Show photo ${thumb + 1}`}
                        onPress={() => goTo(thumb)}
                        style={[styles.thumbHit, selected ? { backgroundColor: colors.foreground } : null]}
                      >
                        <Image
                          source={{ uri: url }}
                          style={[styles.thumb, { backgroundColor: colors.background }]}
                          contentFit="cover"
                        />
                      </Pressable>
                    )
                  })}
                </ScrollView>
                <ChromeButton label="Next photo" name="chevron.right" onPress={() => goTo(index + 1)} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

function ChromeButton({ label, name, onPress }: { label: string; name: "chevron.left" | "chevron.right"; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chromeButton, { backgroundColor: colors.background, borderColor: colors.border }]}
    >
      <SymbolView
        name={{ ios: name, android: name === "chevron.left" ? "chevron_left" : "chevron_right", web: name }}
        size={18}
        tintColor={colors.foreground}
      />
    </Pressable>
  )
}

function ZoomablePhoto({
  uri,
  width,
  height,
  active,
  onZoomedChange,
}: {
  uri: string
  width: number
  height: number
  active: boolean
  onZoomedChange: (zoomed: boolean) => void
}) {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedX = useSharedValue(0)
  const savedY = useSharedValue(0)
  const reported = useSharedValue(false)
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    scale.value = 1
    savedScale.value = 1
    translateX.value = 0
    translateY.value = 0
    savedX.value = 0
    savedY.value = 0
    reported.value = false
    setZoomed(false)
    if (active) onZoomedChange(false)
  }, [active, onZoomedChange, reported, savedScale, savedX, savedY, scale, translateX, translateY, uri])

  function reportZoom(next: boolean) {
    if (active) onZoomedChange(next)
  }

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE)
      const next = scale.value > 1.02
      if (next !== reported.value) {
        reported.value = next
        runOnJS(reportZoom)(next)
      }
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        scale.value = withTiming(1)
        translateX.value = withTiming(0)
        translateY.value = withTiming(0)
        savedScale.value = 1
        savedX.value = 0
        savedY.value = 0
        reported.value = false
        runOnJS(setZoomed)(false)
        runOnJS(reportZoom)(false)
        return
      }
      savedScale.value = scale.value
      runOnJS(setZoomed)(true)
    })

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_event, manager) => {
      if (scale.value > 1.02) manager.activate()
      else manager.fail()
    })
    .onUpdate((event) => {
      const limitX = ((scale.value - 1) * width) / 2
      const limitY = ((scale.value - 1) * height) / 2
      translateX.value = clamp(savedX.value + event.translationX, -limitX, limitX)
      translateY.value = clamp(savedY.value + event.translationY, -limitY, limitY)
    })
    .onEnd(() => {
      savedX.value = translateX.value
      savedY.value = translateY.value
    })

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }))

  const gesture = zoomed ? Gesture.Simultaneous(pinch, pan) : pinch

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.page, { width, height }, animated]}>
        <Image source={{ uri }} style={styles.photo} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  )
}

function clamp(value: number, min: number, max: number) {
  "worklet"
  return Math.min(max, Math.max(min, value))
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stage: { flex: 1 },
  page: { alignItems: "center", justifyContent: "center" },
  photo: { width: "100%", height: "100%" },
  toolbar: { alignItems: "flex-end", paddingHorizontal: 12, paddingBottom: 8 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  chrome: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  dimensions: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  navRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chromeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbScroller: { flexGrow: 0 },
  thumbs: { gap: 6, alignItems: "center", paddingVertical: 2 },
  thumbHit: { padding: 2, borderRadius: 10 },
  thumb: { width: 44, height: 59, borderRadius: 8 },
})
