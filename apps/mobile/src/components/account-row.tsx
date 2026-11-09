import { Image } from "expo-image"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { ProfileCircle } from "@/components/profile-circle"
import { fontFamily, useReswellColors } from "@/theme"

export function AccountRow({
  title,
  subtitle,
  meta,
  imageUrl,
  avatar = false,
  onPress,
}: {
  title: string
  subtitle?: string | null
  meta?: string | null
  imageUrl?: string | null
  /** Person row. Always shows the standard profile circle, including the banner-blue default. */
  avatar?: boolean
  onPress?: () => void
}) {
  const colors = useReswellColors()
  const body = (
    <View style={[styles.row, { borderColor: colors.border }]}>
      {avatar ? (
        <ProfileCircle url={imageUrl} size={48} />
      ) : imageUrl ? (
        <Image source={{ uri: imageUrl }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>{subtitle}</Text>
        ) : null}
      </View>
      {meta ? <Text style={[styles.meta, { color: colors.foreground, fontFamily: fontFamily.text }]}>{meta}</Text> : null}
    </View>
  )
  if (!onPress) return body
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  image: { width: 56, height: 56, borderRadius: 8 },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "600" },
  subtitle: { fontSize: 14 },
  meta: { fontSize: 15, fontWeight: "600" },
})
