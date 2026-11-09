import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { fontFamily, useReswellColors } from "@/theme"

const FALLBACK_TONES = [
  { background: "#355185", foreground: "#FFFFFF" },
  { background: "#5574AD", foreground: "#FFFFFF" },
  { background: "#7F9DD5", foreground: "#163060" },
  { background: "#163060", foreground: "#FFFFFF" },
  { background: "#001A4A", foreground: "#F9F9F2" },
] as const

function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
  if (words.length === 0) return "?"
  const first = words[0]?.[0]
  if (!first) return "?"
  if (words.length === 1) return first.toUpperCase()
  const last = words[words.length - 1]?.[0]
  if (!last) return first.toUpperCase()
  return `${first}${last}`.toUpperCase()
}

function fallbackTone(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return FALLBACK_TONES[hash % FALLBACK_TONES.length] ?? FALLBACK_TONES[0]
}

/** Catalog mark: logo when we have one, otherwise initials on a deterministic Reswell fill. */
export function BrandLogoMark({
  name,
  logoUrl,
  size = 72,
  radius = 16,
  decorative = false,
}: {
  name: string
  logoUrl: string | null
  size?: number
  radius?: number
  decorative?: boolean
}) {
  const colors = useReswellColors()
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const uri = logoUrl?.trim() || null
  const showLogo = Boolean(uri) && failedUrl !== uri
  const tone = fallbackTone(name)
  const inset = Math.max(6, Math.round(size * 0.14))

  return (
    <View
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : `${name} logo`}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderCurve: "continuous",
          backgroundColor: showLogo ? colors.background : tone.background,
          borderColor: showLogo ? colors.border : "transparent",
          borderWidth: showLogo ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      {showLogo && uri ? (
        <Image
          source={{ uri }}
          style={{ width: size - inset * 2, height: size - inset * 2 }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
          onError={() => setFailedUrl(uri)}
        />
      ) : (
        <Text
          style={{
            color: tone.foreground,
            fontFamily: fontFamily.headline,
            fontSize: Math.round(size * 0.34),
            fontWeight: "700",
          }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
})
