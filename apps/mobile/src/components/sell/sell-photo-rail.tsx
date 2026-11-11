import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Pressable, StyleSheet, Text, View, type View as RNView } from "react-native"
import { Gesture, GestureDetector, ScrollView as GestureScrollView } from "react-native-gesture-handler"
import Animated, {
  ReduceMotion,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { moveSellPhoto, type SellPhoto } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export const SELL_PHOTO_TILE_WIDTH = 112
export const SELL_PHOTO_TILE_GAP = 10

const STRIDE = SELL_PHOTO_TILE_WIDTH + SELL_PHOTO_TILE_GAP
const EDGE = 56
const AUTO_SCROLL = 8
const SETTLE = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const

const AnimatedScrollView = Animated.createAnimatedComponent(GestureScrollView)

export function SellPhotoRail({
  photos,
  room,
  onReorder,
  onEdit,
  onRemove,
  onAdd,
  trailing,
}: {
  photos: SellPhoto[]
  room: number
  onReorder: (photos: SellPhoto[]) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
  trailing: ReactNode
}) {
  const colors = useReswellColors()
  const reduced = useReducedMotion()
  const [dragging, setDragging] = useState(false)
  const photosRef = useRef(photos)
  photosRef.current = photos
  const hostRef = useRef<RNView>(null)
  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const dragFrom = useSharedValue(-1)
  const dragHover = useSharedValue(-1)
  const dragTx = useSharedValue(0)
  const dragTy = useSharedValue(0)
  const scrollX = useSharedValue(0)
  const startScrollX = useSharedValue(0)
  const lastTranslationX = useSharedValue(0)
  const fingerX = useSharedValue(0)
  const draggingSv = useSharedValue(0)
  const viewportW = useSharedValue(0)
  const viewportX = useSharedValue(0)
  const contentW = useSharedValue(0)
  const countSv = useSharedValue(photos.length)

  useEffect(() => {
    countSv.set(photos.length)
  }, [countSv, photos.length])

  const resetDrag = useCallback(() => {
    draggingSv.set(0)
    dragFrom.set(-1)
    dragHover.set(-1)
    dragTx.set(0)
    dragTy.set(0)
    setDragging(false)
  }, [dragFrom, dragHover, dragTx, dragTy, draggingSv])

  const onDragActive = useCallback(() => setDragging(true), [])

  const commitReorder = useCallback(
    (from: number, to: number) => {
      resetDrag()
      onReorder(moveSellPhoto(photosRef.current, from, to))
    },
    [onReorder, resetDrag],
  )

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x)
    },
  })

  useFrameCallback(() => {
    if (draggingSv.get() !== 1) return
    const viewW = viewportW.get()
    if (viewW <= 0) return
    const localX = fingerX.get() - viewportX.get()
    let nextScroll = scrollX.get()
    const maxScroll = Math.max(0, contentW.get() - viewW)
    if (localX > viewW - EDGE) nextScroll = Math.min(maxScroll, nextScroll + AUTO_SCROLL)
    else if (localX < EDGE) nextScroll = Math.max(0, nextScroll - AUTO_SCROLL)
    else return
    if (nextScroll === scrollX.get()) return
    scrollX.set(nextScroll)
    scrollTo(scrollRef, nextScroll, 0, false)
    const from = dragFrom.get()
    const visual = lastTranslationX.get() + (nextScroll - startScrollX.get())
    dragTx.set(visual)
    dragHover.set(hoverIndexAt(from, visual, countSv.get()))
  })

  function measureRail() {
    hostRef.current?.measureInWindow((x, _y, width) => {
      viewportX.set(x)
      viewportW.set(width)
    })
  }

  return (
    <View>
      <View ref={hostRef} collapsable={false} onLayout={measureRail}>
        <AnimatedScrollView
          ref={scrollRef}
          horizontal
          nestedScrollEnabled
          scrollEnabled={!dragging}
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal={process.env.EXPO_OS === "ios"}
          overScrollMode="always"
          decelerationRate="normal"
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          onContentSizeChange={(width) => contentW.set(width)}
          style={styles.scroller}
          contentContainerStyle={styles.rail}
        >
          {photos.map((photo, index) => (
            <SortableSellPhotoTile
              key={photo.id}
              photo={photo}
              index={index}
              count={photos.length}
              reduced={reduced}
              dragFrom={dragFrom}
              dragHover={dragHover}
              dragTx={dragTx}
              dragTy={dragTy}
              scrollX={scrollX}
              startScrollX={startScrollX}
              lastTranslationX={lastTranslationX}
              fingerX={fingerX}
              draggingSv={draggingSv}
              countSv={countSv}
              onEdit={onEdit}
              onRemove={onRemove}
              onDragActive={onDragActive}
              onCommit={commitReorder}
              onCancel={resetDrag}
            />
          ))}
          {Array.from({ length: room }, (_, index) => (
            <Pressable
              key={`empty-${index}`}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              onPress={onAdd}
              style={[styles.tile, styles.empty, { borderColor: colors.foreground, backgroundColor: colors.image }]}
            >
              <Text style={[styles.plus, { color: colors.muted }]}>+</Text>
            </Pressable>
          ))}
          {trailing}
        </AnimatedScrollView>
      </View>
      {photos.length > 1 ? (
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Hold and drag to reorder. The first photo is the cover.
        </Text>
      ) : null}
    </View>
  )
}

function hoverIndexAt(from: number, visualX: number, count: number) {
  "worklet"
  if (count <= 1) return from
  return Math.max(0, Math.min(count - 1, Math.round((from * STRIDE + visualX) / STRIDE)))
}

function SortableSellPhotoTile({
  photo,
  index,
  count,
  reduced,
  dragFrom,
  dragHover,
  dragTx,
  dragTy,
  scrollX,
  startScrollX,
  lastTranslationX,
  fingerX,
  draggingSv,
  countSv,
  onEdit,
  onRemove,
  onDragActive,
  onCommit,
  onCancel,
}: {
  photo: SellPhoto
  index: number
  count: number
  reduced: boolean
  dragFrom: SharedValue<number>
  dragHover: SharedValue<number>
  dragTx: SharedValue<number>
  dragTy: SharedValue<number>
  scrollX: SharedValue<number>
  startScrollX: SharedValue<number>
  lastTranslationX: SharedValue<number>
  fingerX: SharedValue<number>
  draggingSv: SharedValue<number>
  countSv: SharedValue<number>
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  onDragActive: () => void
  onCommit: (from: number, to: number) => void
  onCancel: () => void
}) {
  const colors = useReswellColors()
  const indexSv = useSharedValue(index)
  const photoId = photo.id

  useEffect(() => {
    indexSv.set(index)
  }, [index, indexSv])

  const tap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        scheduleOnRN(onEdit, photoId)
      }),
    [onEdit, photoId],
  )

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(220)
        .maxPointers(1)
        .onStart(() => {
          const from = indexSv.get()
          draggingSv.set(1)
          startScrollX.set(scrollX.get())
          lastTranslationX.set(0)
          dragTx.set(0)
          dragTy.set(0)
          dragFrom.set(from)
          dragHover.set(from)
          scheduleOnRN(onDragActive)
        })
        .onUpdate((event) => {
          const scrollDelta = scrollX.get() - startScrollX.get()
          const visual = event.translationX + scrollDelta
          lastTranslationX.set(event.translationX)
          fingerX.set(event.absoluteX)
          dragTx.set(visual)
          dragTy.set(event.translationY)
          dragHover.set(hoverIndexAt(dragFrom.get(), visual, countSv.get()))
        })
        .onEnd((_event, success) => {
          const from = dragFrom.get()
          const hover = dragHover.get()
          draggingSv.set(0)
          if (success && from >= 0 && hover >= 0 && from !== hover) {
            scheduleOnRN(onCommit, from, hover)
            return
          }
          scheduleOnRN(onCancel)
        }),
    [
      countSv,
      dragFrom,
      dragHover,
      dragTx,
      dragTy,
      draggingSv,
      fingerX,
      indexSv,
      lastTranslationX,
      onCancel,
      onCommit,
      onDragActive,
      scrollX,
      startScrollX,
    ],
  )

  const gesture = useMemo(
    () => (count > 1 ? Gesture.Exclusive(pan, tap) : tap),
    [count, pan, tap],
  )

  const animatedStyle = useAnimatedStyle(() => {
    const from = dragFrom.get()
    const hover = dragHover.get()
    const current = indexSv.get()
    if (from === current) {
      return {
        zIndex: 20,
        transform: [{ translateX: dragTx.get() }, { translateY: dragTy.get() }, { scale: reduced ? 1 : 1.05 }],
      }
    }
    let shift = 0
    if (from >= 0 && hover >= 0 && from !== hover) {
      if (from < hover && current > from && current <= hover) shift = -STRIDE
      if (from > hover && current >= hover && current < from) shift = STRIDE
    }
    return {
      zIndex: 0,
      transform: [{ translateX: withSpring(shift, SETTLE) }, { translateY: 0 }, { scale: 1 }],
    }
  })

  return (
    <Animated.View style={[styles.lift, animatedStyle]}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          collapsable={false}
          accessible
          accessibilityRole="button"
          accessibilityLabel={index === 0 ? `Cover photo ${index + 1}` : `Photo ${index + 1}`}
          accessibilityHint={count > 1 ? "Double tap to edit. Hold and drag to reorder." : "Double tap to edit."}
          style={styles.tile}
        >
          <Image source={{ uri: photo.uri }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
          {index === 0 ? (
            <View style={styles.cover}>
              <Text style={[styles.coverLabel, { fontFamily: fontFamily.text }]}>Cover</Text>
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove photo"
        onPress={() => onRemove(photo.id)}
        hitSlop={4}
        style={styles.remove}
      >
        <SymbolView name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }} size={20} tintColor="#FFFFFF" />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0, overflow: "visible" },
  rail: { gap: SELL_PHOTO_TILE_GAP, flexDirection: "row", alignItems: "center", paddingRight: 4 },
  lift: { width: SELL_PHOTO_TILE_WIDTH, aspectRatio: 3 / 4 },
  tile: {
    width: SELL_PHOTO_TILE_WIDTH,
    aspectRatio: 3 / 4,
    borderRadius: 10,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { fontSize: 24, fontWeight: "500" },
  image: { width: "100%", height: "100%", backgroundColor: "#F3F4F6" },
  cover: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  remove: { position: "absolute", top: 6, right: 6, zIndex: 21 },
  hint: { marginTop: 10, fontSize: 13, lineHeight: 18 },
})
