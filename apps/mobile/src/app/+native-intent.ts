import { nativeIntentPath } from "@reswell/api-contract"

/**
 * Rewrites https://www.reswell.app/... email/web links onto Expo Router screens.
 * Expo CLI's `reswell://expo-development-client?url=…` is sent home so it is
 * not shown as an unmatched route after the native client loads Metro.
 */
export function redirectSystemPath({
  path,
}: {
  path: string
  initial: boolean
}): string {
  try {
    return nativeIntentPath(path)
  } catch {
    return "/"
  }
}
