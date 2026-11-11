import { useEffect, useState } from "react"
import { Platform, StyleSheet, TextInput, View } from "react-native"
import type { StyleProp, TextInputProps, TextStyle } from "react-native"

const DEFAULT_MIN_HEIGHT = 36
const DEFAULT_MAX_HEIGHT = 132

type GrowingComposerInputProps = Omit<TextInputProps, "multiline" | "scrollEnabled"> & {
  minHeight?: number
  maxHeight?: number
}

function clampHeight(height: number, minHeight: number, maxHeight: number): number {
  return Math.min(maxHeight, Math.max(minHeight, Math.ceil(height)))
}

/**
 * Auto-growing multiline field. Width is locked to the row (not the typed
 * text), so long strings wrap onto a new line the way the web /messages
 * textarea does, instead of running sideways.
 */
export function GrowingComposerInput({
  value,
  onChangeText,
  style,
  minHeight = DEFAULT_MIN_HEIGHT,
  maxHeight = DEFAULT_MAX_HEIGHT,
  ...props
}: GrowingComposerInputProps) {
  const [height, setHeight] = useState(minHeight)
  const atMax = height >= maxHeight

  useEffect(() => {
    if (!value) setHeight(minHeight)
  }, [value, minHeight])

  return (
    <View style={styles.wrap}>
      <TextInput
        {...props}
        value={value}
        multiline
        textAlignVertical="top"
        scrollEnabled={atMax}
        textBreakStrategy="highQuality"
        onChangeText={(next) => {
          onChangeText?.(next)
          if (next.length === 0) setHeight(minHeight)
        }}
        onContentSizeChange={(event) => {
          setHeight(clampHeight(event.nativeEvent.contentSize.height, minHeight, maxHeight))
        }}
        style={[styles.input, webInputStyle, { height }, style] as StyleProp<TextStyle>}
      />
    </View>
  )
}

const webInputStyle: TextStyle | null =
  Platform.OS === "web"
    ? ({
        outlineStyle: "none",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
      } as TextStyle)
    : null

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    alignSelf: "stretch",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },
  input: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: 0,
    fontSize: 16,
    lineHeight: 21,
  },
})
