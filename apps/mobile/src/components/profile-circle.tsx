import { Image } from "expo-image"
import { View, type StyleProp, type ViewStyle } from "react-native"
import { publicSiteUrl } from "@/lib/public-env"

const DEFAULT_PROFILE_PATH = "/images/reswell-profile-default.png"
/** Empty seller banner. Same as `SELLER_PROFILE_BANNER_DEFAULT`. */
const DEFAULT_PROFILE_BLUE = "#5574AD"

/** Same public file the API returns when a profile has no photo. */
export function standardProfileAvatarUrl(): string {
  return `${publicSiteUrl().replace(/\/$/, "")}${DEFAULT_PROFILE_PATH}`
}

function isDefaultProfileAvatar(url: string | null | undefined): boolean {
  const trimmed = url?.trim()
  if (!trimmed) return true
  return trimmed.includes(DEFAULT_PROFILE_PATH)
}

export function ProfileCircle({
  url,
  size,
  style,
}: {
  url?: string | null
  size: number
  style?: StyleProp<ViewStyle>
}) {
  const circle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: DEFAULT_PROFILE_BLUE,
  }
  const photo = url?.trim()
  if (!photo || isDefaultProfileAvatar(photo)) {
    return <View style={[circle, style]} />
  }
  return (
    <Image
      source={{ uri: photo }}
      accessibilityIgnoresInvertColors
      style={[circle, style]}
      contentFit="cover"
    />
  )
}
