import { Platform, UIManager } from "react-native"

/** True when the dev client / store build includes react-native-svg native code. */
export function isNativeSvgAvailable(): boolean {
  if (Platform.OS === "web") return true
  return UIManager.getViewManagerConfig("RNSVGSvgView") != null
}
