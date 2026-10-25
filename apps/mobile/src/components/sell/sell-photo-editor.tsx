import { manipulateAsync, SaveFormat } from "expo-image-manipulator"
import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Image as RNImage, Modal, Pressable, StatusBar, StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fontFamily } from "@/theme"

type Aspect = "original" | "square" | "listing"

const ASPECTS: { id: Aspect; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "square", label: "Square" },
  { id: "listing", label: "3:4" },
]

const TICKS = 31
const PIXELS_PER_DEGREE = 3

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
  const [aspect, setAspect] = useState<Aspect>("original")
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const adjusted = useRef(false)

  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const savedTx = useSharedValue(0)
  const savedTy = useSharedValue(0)
  const rotation = useSharedValue(0)
  const savedFine = useSharedValue(0)
  const stageW = useSharedValue(0)
  const stageH = useSharedValue(0)

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

  const imageRatio = pixel && pixel.height > 0 ? pixel.width / pixel.height : 1
  const frameRatio = aspect === "square" ? 1 : aspect === "listing" ? 3 / 4 : imageRatio
  const maxW = Math.max(1, stage.width - 28)
  const maxH = Math.max(1, stage.height - 28)
  let frameW = maxW
  let frameH = frameW / frameRatio
  if (frameH > maxH) {
    frameH = maxH
    frameW = frameH * frameRatio
  }
  const displayW = frameW
  const displayH = pixel ? displayW * (pixel.height / pixel.width) : frameH

  function coverScale(degrees: number) {
    const rad = (degrees * Math.PI) / 180
    const c = Math.abs(Math.cos(rad))
    const s = Math.abs(Math.sin(rad))
    const boundW = displayW * c + displayH * s
    const boundH = displayW * s + displayH * c
    if (boundW <= 0 || boundH <= 0) return 1
    return Math.max(frameW / boundW, frameH / boundH)
  }

  const fitKey = `${aspect}|${source}|${pixel?.width ?? 0}|${pixel?.height ?? 0}|${Math.round(frameW)}|${Math.round(frameH)}`
  useEffect(() => {
    adjusted.current = false
  }, [aspect, source])
  useEffect(() => {
    if (!pixel || frameW <= 1 || frameH <= 1 || adjusted.current) return
    const start = coverScale(savedFine.value)
    scale.value = start
    savedScale.value = start
    tx.value = 0
    ty.value = 0
    savedTx.value = 0
    savedTy.value = 0
  }, [fitKey, pixel, frameW, frameH, scale, savedScale, tx, ty, savedTx, savedTy, savedFine])

  function markAdjusted() {
    adjusted.current = true
  }

  function resetView() {
    scale.value = coverScale(0)
    savedScale.value = scale.value
    tx.value = 0
    ty.value = 0
    savedTx.value = 0
    savedTy.value = 0
    rotation.value = 0
    savedFine.value = 0
  }

  function clampToFrame(nextScale: number, nextX: number, nextY: number, degrees: number) {
    "worklet"
    const rad = (degrees * Math.PI) / 180
    const c = Math.abs(Math.cos(rad))
    const s = Math.abs(Math.sin(rad))
    const min = Math.max(frameW / (displayW * c + displayH * s), frameH / (displayW * s + displayH * c))
    const clampedScale = Math.max(nextScale, Number.isFinite(min) ? min : 1)
    const maxX = Math.max(0, (displayW * clampedScale * c + displayH * clampedScale * s - frameW) / 2)
    const maxY = Math.max(0, (displayW * clampedScale * s + displayH * clampedScale * c - frameH) / 2)
    return {
      scale: clampedScale,
      x: Math.min(maxX, Math.max(-maxX, nextX)),
      y: Math.min(maxY, Math.max(-maxY, nextY)),
    }
  }

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      runOnJS(markAdjusted)()
    })
    .onUpdate((event) => {
      const nextScale = savedScale.value * event.scale
      const ratio = savedScale.value > 0 ? nextScale / savedScale.value : 1
      const focalX = event.focalX - stageW.value / 2
      const focalY = event.focalY - stageH.value / 2
      const nextX = focalX * (1 - ratio) + savedTx.value * ratio
      const nextY = focalY * (1 - ratio) + savedTy.value * ratio
      const next = clampToFrame(nextScale, nextX, nextY, savedFine.value)
      scale.value = next.scale
      tx.value = next.x
      ty.value = next.y
    })
    .onEnd(() => {
      const next = clampToFrame(scale.value, tx.value, ty.value, savedFine.value)
      scale.value = next.scale
      tx.value = next.x
      ty.value = next.y
      savedScale.value = next.scale
      savedTx.value = next.x
      savedTy.value = next.y
    })

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      runOnJS(markAdjusted)()
    })
    .onUpdate((event) => {
      const next = clampToFrame(scale.value, savedTx.value + event.translationX, savedTy.value + event.translationY, savedFine.value)
      tx.value = next.x
      ty.value = next.y
    })
    .onEnd(() => {
      savedTx.value = tx.value
      savedTy.value = ty.value
    })

  const dial = Gesture.Pan()
    .onBegin(() => {
      runOnJS(markAdjusted)()
    })
    .onUpdate((event) => {
      const nextFine = Math.min(45, Math.max(-45, savedFine.value - event.translationX / PIXELS_PER_DEGREE))
      rotation.value = (nextFine * Math.PI) / 180
      const next = clampToFrame(Math.max(scale.value, savedScale.value), tx.value, ty.value, nextFine)
      scale.value = next.scale
      tx.value = next.x
      ty.value = next.y
    })
    .onEnd((event) => {
      const nextFine = Math.min(45, Math.max(-45, savedFine.value - event.translationX / PIXELS_PER_DEGREE))
      savedFine.value = nextFine
      rotation.value = (nextFine * Math.PI) / 180
      const next = clampToFrame(scale.value, tx.value, ty.value, nextFine)
      scale.value = next.scale
      savedScale.value = next.scale
      tx.value = next.x
      ty.value = next.y
      savedTx.value = next.x
      savedTy.value = next.y
    })

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }))

  const rulerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -((rotation.value * 180) / Math.PI) * PIXELS_PER_DEGREE }],
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
        scale: scale.value,
        translateX: tx.value,
        translateY: ty.value,
        rotationDeg: (rotation.value * 180) / Math.PI,
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
            stageW.value = event.nativeEvent.layout.width
            stageH.value = event.nativeEvent.layout.height
            setStage({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })
          }}
        >
          <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
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
          <View style={styles.aspects}>
            {ASPECTS.map((option) => {
              const selected = option.id === aspect
              return (
                <Pressable key={option.id} accessibilityRole="button" onPress={() => setAspect(option.id)} style={styles.aspect}>
                  <Text style={[styles.aspectLabel, { fontFamily: fontFamily.text, color: selected ? "#FFFFFF" : "#A1A1AA" }]}>
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          {error ? <Text style={[styles.error, { fontFamily: fontFamily.text }]}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  )
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
  aspects: { flexDirection: "row", justifyContent: "center", gap: 28 },
  aspect: { minHeight: 32, justifyContent: "center" },
  aspectLabel: { fontSize: 15, fontWeight: "600" },
  error: { color: "#FCA5A5", fontSize: 13, textAlign: "center" },
})
