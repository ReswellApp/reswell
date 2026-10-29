import { manipulateAsync, SaveFormat } from "expo-image-manipulator"
import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Image as RNImage, Modal, Pressable, StatusBar, StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fontFamily } from "@/theme"

const LISTING_RATIO = 3 / 4
const MAX_ZOOM = 4
const TICKS = 31
const PIXELS_PER_DEGREE = 3
const SETTLE = {
  duration: 400,
  dampingRatio: 0.8,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
} as const

export function SellPhotoEditor({
  uri,
  onCancel,
  onSave,
}: {
  uri: string
  onCancel: () => void
  onSave: (uri: string) => void
}) {
  const insets = useSafeAreaInsets()
  const [source, setSource] = useState(uri)
  const [pixel, setPixel] = useState<{ width: number; height: number } | null>(null)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const adjusted = useRef(false)

  const scale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const rotation = useSharedValue(0)
  const savedFine = useSharedValue(0)
  const stageW = useSharedValue(0)
  const stageH = useSharedValue(0)
  const frameWSv = useSharedValue(1)
  const frameHSv = useSharedValue(1)
  const displayWSv = useSharedValue(1)
  const displayHSv = useSharedValue(1)
  const originScale = useSharedValue(1)
  const originTx = useSharedValue(0)
  const originTy = useSharedValue(0)
  const originFocalX = useSharedValue(0)
  const originFocalY = useSharedValue(0)

  useEffect(() => {
    let cancelled = false
    RNImage.getSize(
      source,
      (width, height) => {
        if (!cancelled) setPixel({ width, height })
      },
      () => {
        if (!cancelled) setError("Couldn't read that photo.")
      },
    )
    return () => {
      cancelled = true
    }
  }, [source])

  const maxW = Math.max(1, stage.width - 28)
  const maxH = Math.max(1, stage.height - 28)
  let frameW = maxW
  let frameH = frameW / LISTING_RATIO
  if (frameH > maxH) {
    frameH = maxH
    frameW = frameH * LISTING_RATIO
  }
  const imageRatio = pixel && pixel.height > 0 ? pixel.width / pixel.height : LISTING_RATIO
  const cover = coverSize(imageRatio, frameW, frameH)
  const displayW = cover.width
  const displayH = cover.height
  const fitKey = `${source}|${pixel?.width ?? 0}|${pixel?.height ?? 0}|${Math.round(frameW)}|${Math.round(frameH)}`

  useEffect(() => {
    adjusted.current = false
  }, [source])

  useEffect(() => {
    frameWSv.set(frameW)
    frameHSv.set(frameH)
    displayWSv.set(displayW)
    displayHSv.set(displayH)
  }, [displayH, displayHSv, displayW, displayWSv, frameH, frameHSv, frameW, frameWSv])

  useEffect(() => {
    if (!pixel || frameW <= 1 || frameH <= 1 || adjusted.current) return
    const start = minCoverScale(savedFine.get(), displayW, displayH, frameW, frameH)
    cancelAnimation(scale)
    cancelAnimation(tx)
    cancelAnimation(ty)
    scale.set(start)
    tx.set(0)
    ty.set(0)
  }, [displayH, displayW, fitKey, frameH, frameW, pixel, savedFine, scale, tx, ty])

  const markAdjusted = useCallback(() => {
    adjusted.current = true
  }, [])

  function resetView() {
    adjusted.current = false
    cancelAnimation(scale)
    cancelAnimation(tx)
    cancelAnimation(ty)
    cancelAnimation(rotation)
    scale.set(minCoverScale(0, displayW, displayH, frameW, frameH))
    tx.set(0)
    ty.set(0)
    rotation.set(0)
    savedFine.set(0)
  }

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin((event) => {
          cancelAnimation(scale)
          cancelAnimation(tx)
          cancelAnimation(ty)
          originScale.set(scale.get())
          originTx.set(tx.get())
          originTy.set(ty.get())
          originFocalX.set(event.focalX)
          originFocalY.set(event.focalY)
          scheduleOnRN(markAdjusted)
        })
        .onUpdate((event) => {
          const degrees = savedFine.get()
          const displayWidth = displayWSv.get()
          const displayHeight = displayHSv.get()
          const frameWidth = frameWSv.get()
          const frameHeight = frameHSv.get()
          const min = minCoverScale(degrees, displayWidth, displayHeight, frameWidth, frameHeight)
          const max = Math.max(min, MAX_ZOOM)
          const nextScale = rubberbandScale(originScale.get() * event.scale, min, max)
          const ratio = originScale.get() > 0 ? nextScale / originScale.get() : 1
          const startFocalX = originFocalX.get() - stageW.get() / 2
          const startFocalY = originFocalY.get() - stageH.get() / 2
          const currentFocalX = event.focalX - stageW.get() / 2
          const currentFocalY = event.focalY - stageH.get() / 2
          const nextX = originTx.get() * ratio + startFocalX * (1 - ratio) + (currentFocalX - startFocalX)
          const nextY = originTy.get() * ratio + startFocalY * (1 - ratio) + (currentFocalY - startFocalY)
          const edge = panExtent(nextScale, degrees, displayWidth, displayHeight, frameWidth, frameHeight)
          scale.set(nextScale)
          tx.set(rubberbandAxis(nextX, edge.maxX, frameWidth))
          ty.set(rubberbandAxis(nextY, edge.maxY, frameHeight))
        })
        .onEnd((event) => {
          settleTransform({
            scale,
            tx,
            ty,
            nextScale: scale.get(),
            nextX: tx.get(),
            nextY: ty.get(),
            degrees: savedFine.get(),
            displayW: displayWSv.get(),
            displayH: displayHSv.get(),
            frameW: frameWSv.get(),
            frameH: frameHSv.get(),
            velocityScale: event.velocity,
            velocityX: 0,
            velocityY: 0,
          })
        }),
    [displayHSv, displayWSv, frameHSv, frameWSv, markAdjusted, originFocalX, originFocalY, originScale, originTx, originTy, savedFine, scale, stageH, stageW, tx, ty],
  )

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .minDistance(0)
        .onBegin(() => {
          cancelAnimation(scale)
          cancelAnimation(tx)
          cancelAnimation(ty)
          originTx.set(tx.get())
          originTy.set(ty.get())
          scheduleOnRN(markAdjusted)
        })
        .onUpdate((event) => {
          const degrees = savedFine.get()
          const displayWidth = displayWSv.get()
          const displayHeight = displayHSv.get()
          const frameWidth = frameWSv.get()
          const frameHeight = frameHSv.get()
          const edge = panExtent(scale.get(), degrees, displayWidth, displayHeight, frameWidth, frameHeight)
          tx.set(rubberbandAxis(originTx.get() + event.translationX, edge.maxX, frameWidth))
          ty.set(rubberbandAxis(originTy.get() + event.translationY, edge.maxY, frameHeight))
        })
        .onEnd((event) => {
          const projectedX = tx.get() + project(event.velocityX)
          const projectedY = ty.get() + project(event.velocityY)
          settleTransform({
            scale,
            tx,
            ty,
            nextScale: scale.get(),
            nextX: projectedX,
            nextY: projectedY,
            degrees: savedFine.get(),
            displayW: displayWSv.get(),
            displayH: displayHSv.get(),
            frameW: frameWSv.get(),
            frameH: frameHSv.get(),
            velocityScale: 0,
            velocityX: event.velocityX,
            velocityY: event.velocityY,
          })
        }),
    [displayHSv, displayWSv, frameHSv, frameWSv, markAdjusted, originTx, originTy, savedFine, scale, tx, ty],
  )

  const dial = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          scheduleOnRN(markAdjusted)
        })
        .onUpdate((event) => {
          const nextFine = Math.min(45, Math.max(-45, savedFine.get() - event.translationX / PIXELS_PER_DEGREE))
          rotation.set((nextFine * Math.PI) / 180)
          const next = clampTransform(
            scale.get(),
            tx.get(),
            ty.get(),
            nextFine,
            displayWSv.get(),
            displayHSv.get(),
            frameWSv.get(),
            frameHSv.get(),
          )
          scale.set(next.scale)
          tx.set(next.x)
          ty.set(next.y)
        })
        .onEnd((event) => {
          const nextFine = Math.min(45, Math.max(-45, savedFine.get() - event.translationX / PIXELS_PER_DEGREE))
          savedFine.set(nextFine)
          rotation.set((nextFine * Math.PI) / 180)
          settleTransform({
            scale,
            tx,
            ty,
            nextScale: scale.get(),
            nextX: tx.get(),
            nextY: ty.get(),
            degrees: nextFine,
            displayW: displayWSv.get(),
            displayH: displayHSv.get(),
            frameW: frameWSv.get(),
            frameH: frameHSv.get(),
            velocityScale: 0,
            velocityX: 0,
            velocityY: 0,
          })
        }),
    [displayHSv, displayWSv, frameHSv, frameWSv, markAdjusted, rotation, savedFine, scale, tx, ty],
  )

  const cropGesture = useMemo(() => Gesture.Simultaneous(pinch, pan), [pan, pinch])

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() },
      { translateY: ty.get() },
      { scale: scale.get() },
      { rotate: `${rotation.get()}rad` },
    ],
  }))

  const rulerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -((rotation.get() * 180) / Math.PI) * PIXELS_PER_DEGREE }],
  }))

  async function rotateQuarter() {
    setSaving(true)
    setError(null)
    try {
      const result = await manipulateAsync(source, [{ rotate: -90 }], { compress: 1, format: SaveFormat.JPEG })
      setSource(result.uri)
      setPixel({ width: result.width, height: result.height })
      resetView()
    } catch {
      setError("Couldn't rotate that photo. Rebuild the app if this keeps happening.")
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    if (!pixel || saving) return
    setSaving(true)
    setError(null)
    try {
      const crop = cropInRotatedImage({
        imageWidth: pixel.width,
        imageHeight: pixel.height,
        displayWidth: displayW,
        frameWidth: frameW,
        frameHeight: frameH,
        scale: scale.get(),
        translateX: tx.get(),
        translateY: ty.get(),
        rotationDeg: (rotation.get() * 180) / Math.PI,
      })
      const actions = Math.abs(crop.rotate) > 0.01 ? [{ rotate: crop.rotate } as const] : []
      const result = await manipulateAsync(
        source,
        [...actions, { crop: { originX: crop.originX, originY: crop.originY, width: crop.width, height: crop.height } }],
        { compress: 0.92, format: SaveFormat.JPEG },
      )
      onSave(result.uri)
    } catch {
      setError("Couldn't save that crop. Rebuild the app if this keeps happening.")
      setSaving(false)
    }
  }

  const frameLeft = (stage.width - frameW) / 2
  const frameTop = (stage.height - frameH) / 2

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8} disabled={saving}>
            <Text style={[styles.barLabel, { fontFamily: fontFamily.text }]}>Cancel</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void save()} disabled={saving || !pixel} hitSlop={8}>
            {saving ? <ActivityIndicator color="#FFD60A" /> : <Text style={[styles.done, { fontFamily: fontFamily.text }]}>Done</Text>}
          </Pressable>
        </View>

        <View
          style={styles.stage}
          onLayout={(event) => {
            stageW.set(event.nativeEvent.layout.width)
            stageH.set(event.nativeEvent.layout.height)
            setStage({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })
          }}
        >
          <GestureDetector gesture={cropGesture}>
            <View style={styles.gestureFill}>
              {pixel && stage.width > 0 ? (
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      left: (stage.width - displayW) / 2,
                      top: (stage.height - displayH) / 2,
                      width: displayW,
                      height: displayH,
                    },
                    imageStyle,
                  ]}
                >
                  <Image source={{ uri: source }} style={{ width: displayW, height: displayH }} contentFit="fill" />
                </Animated.View>
              ) : null}
            </View>
          </GestureDetector>
          {stage.width > 0 ? (
            <View pointerEvents="none" style={styles.mask}>
              <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, frameTop) }]} />
              <View style={[styles.dim, { bottom: 0, left: 0, right: 0, height: Math.max(0, stage.height - frameTop - frameH) }]} />
              <View style={[styles.dim, { top: frameTop, left: 0, width: Math.max(0, frameLeft), height: frameH }]} />
              <View style={[styles.dim, { top: frameTop, right: 0, width: Math.max(0, frameLeft), height: frameH }]} />
              <View style={[styles.frame, { left: frameLeft, top: frameTop, width: frameW, height: frameH }]}>
                <View style={[styles.gridV, { left: "33.33%" }]} />
                <View style={[styles.gridV, { left: "66.66%" }]} />
                <View style={[styles.gridH, { top: "33.33%" }]} />
                <View style={[styles.gridH, { top: "66.66%" }]} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.controls}>
          <View style={styles.toolRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Rotate left" onPress={() => void rotateQuarter()} style={styles.iconButton} disabled={saving}>
              <SymbolView name={{ ios: "arrow.counterclockwise", android: "rotate_left", web: "rotate_left" }} size={22} tintColor="#FFFFFF" />
            </Pressable>
            <GestureDetector gesture={dial}>
              <View style={styles.dialWindow}>
                <Animated.View style={[styles.ruler, rulerStyle]}>
                  {Array.from({ length: TICKS }, (_, index) => (
                    <View key={index} style={[styles.tick, (index - 15) % 5 === 0 ? styles.tickMajor : null]} />
                  ))}
                </Animated.View>
                <View pointerEvents="none" style={styles.needle} />
              </View>
            </GestureDetector>
            <Pressable accessibilityRole="button" onPress={resetView} disabled={saving}>
              <Text style={[styles.barLabel, { fontFamily: fontFamily.text }]}>Reset</Text>
            </Pressable>
          </View>
          {error ? <Text style={[styles.error, { fontFamily: fontFamily.text }]}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  )
}

function coverSize(imageRatio: number, frameW: number, frameH: number) {
  const frameRatio = frameW / frameH
  if (imageRatio > frameRatio) {
    return { width: frameH * imageRatio, height: frameH }
  }
  return { width: frameW, height: frameW / imageRatio }
}

function minCoverScale(degrees: number, displayW: number, displayH: number, frameW: number, frameH: number) {
  "worklet"
  const rad = (degrees * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  const boundW = displayW * c + displayH * s
  const boundH = displayW * s + displayH * c
  if (boundW <= 0 || boundH <= 0) return 1
  return Math.max(frameW / boundW, frameH / boundH)
}

function panExtent(
  nextScale: number,
  degrees: number,
  displayW: number,
  displayH: number,
  frameW: number,
  frameH: number,
) {
  "worklet"
  const rad = (degrees * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  return {
    maxX: Math.max(0, (displayW * nextScale * c + displayH * nextScale * s - frameW) / 2),
    maxY: Math.max(0, (displayW * nextScale * s + displayH * nextScale * c - frameH) / 2),
  }
}

function clampTransform(
  nextScale: number,
  nextX: number,
  nextY: number,
  degrees: number,
  displayW: number,
  displayH: number,
  frameW: number,
  frameH: number,
) {
  "worklet"
  const min = minCoverScale(degrees, displayW, displayH, frameW, frameH)
  const max = Math.max(min, MAX_ZOOM)
  const clampedScale = Math.min(max, Math.max(min, nextScale))
  const edge = panExtent(clampedScale, degrees, displayW, displayH, frameW, frameH)
  return {
    scale: clampedScale,
    x: Math.min(edge.maxX, Math.max(-edge.maxX, nextX)),
    y: Math.min(edge.maxY, Math.max(-edge.maxY, nextY)),
  }
}

function settleTransform(input: {
  scale: { set: (value: number) => void }
  tx: { set: (value: number) => void }
  ty: { set: (value: number) => void }
  nextScale: number
  nextX: number
  nextY: number
  degrees: number
  displayW: number
  displayH: number
  frameW: number
  frameH: number
  velocityScale: number
  velocityX: number
  velocityY: number
}) {
  "worklet"
  const next = clampTransform(
    input.nextScale,
    input.nextX,
    input.nextY,
    input.degrees,
    input.displayW,
    input.displayH,
    input.frameW,
    input.frameH,
  )
  input.scale.set(withSpring(next.scale, { ...SETTLE, velocity: input.velocityScale }))
  input.tx.set(withSpring(next.x, { ...SETTLE, velocity: input.velocityX }))
  input.ty.set(withSpring(next.y, { ...SETTLE, velocity: input.velocityY }))
}

function project(velocity: number, decelerationRate = 0.998) {
  "worklet"
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  "worklet"
  const size = Math.max(1, dimension)
  return (overshoot * size * constant) / (size + constant * Math.abs(overshoot))
}

function rubberbandScale(nextScale: number, min: number, max: number) {
  "worklet"
  if (nextScale > max) return max + rubberband(nextScale - max, max)
  if (nextScale < min) return min - rubberband(min - nextScale, min)
  return nextScale
}

function rubberbandAxis(value: number, max: number, dimension: number) {
  "worklet"
  if (value > max) return max + rubberband(value - max, dimension)
  if (value < -max) return -max - rubberband(-max - value, dimension)
  return value
}

function cropInRotatedImage(input: {
  imageWidth: number
  imageHeight: number
  displayWidth: number
  frameWidth: number
  frameHeight: number
  scale: number
  translateX: number
  translateY: number
  rotationDeg: number
}) {
  const theta = (input.rotationDeg * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const pixelsPerPoint = input.imageWidth / input.displayWidth
  const localX = ((-input.translateX * cos - input.translateY * sin) / input.scale) * pixelsPerPoint
  const localY = ((input.translateX * sin - input.translateY * cos) / input.scale) * pixelsPerPoint
  const rotatedX = localX * cos - localY * sin
  const rotatedY = localX * sin + localY * cos
  const canvas = rotatedCanvas(input.imageWidth, input.imageHeight, input.rotationDeg)
  const cropW = Math.min(canvas.width, (input.frameWidth / input.scale) * pixelsPerPoint)
  const cropH = Math.min(canvas.height, (input.frameHeight / input.scale) * pixelsPerPoint)
  const originX = Math.round(clamp(canvas.width / 2 + rotatedX - cropW / 2, 0, Math.max(0, canvas.width - cropW)))
  const originY = Math.round(clamp(canvas.height / 2 + rotatedY - cropH / 2, 0, Math.max(0, canvas.height - cropH)))
  return {
    rotate: input.rotationDeg,
    originX,
    originY,
    width: Math.max(1, Math.min(Math.round(cropW), Math.floor(canvas.width) - originX)),
    height: Math.max(1, Math.min(Math.round(cropH), Math.floor(canvas.height) - originY)),
  }
}

function rotatedCanvas(width: number, height: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  return { width: width * c + height * s, height: width * s + height * c }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  topBar: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  barLabel: { color: "#FFFFFF", fontSize: 17 },
  done: { color: "#FFD60A", fontSize: 17, fontWeight: "600" },
  stage: { flex: 1 },
  gestureFill: { flex: 1 },
  mask: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  dim: { position: "absolute", backgroundColor: "rgba(0,0,0,0.55)" },
  frame: { position: "absolute", borderWidth: StyleSheet.hairlineWidth, borderColor: "#FFFFFF" },
  gridV: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.55)" },
  gridH: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.55)" },
  controls: { paddingHorizontal: 16, paddingBottom: 8, gap: 16 },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  dialWindow: { flex: 1, height: 44, overflow: "hidden", justifyContent: "center" },
  ruler: { flexDirection: "row", alignItems: "center", alignSelf: "center", height: 28 },
  tick: { width: PIXELS_PER_DEGREE * 3, height: 10, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.45)" },
  tickMajor: { height: 18, borderRightColor: "#FFFFFF" },
  needle: {
    position: "absolute",
    alignSelf: "center",
    width: 2,
    height: 28,
    backgroundColor: "#FFD60A",
  },
  error: { color: "#FCA5A5", fontSize: 13, textAlign: "center" },
})
