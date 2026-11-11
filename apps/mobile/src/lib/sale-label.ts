import { Linking, Platform, Share } from "react-native"
import { fetchSaleLabel, saleLabelImageUrl } from "@/lib/api"

export { saleLabelHref } from "@/lib/sale-label-href"

const LABEL_DOWNLOAD_ERROR = "Unable to download the shipping label"
const LABEL_SHARE_ERROR = "Unable to share the shipping label"
const LABEL_PRINT_ERROR = "Unable to print the shipping label"

type ExpoPrint = typeof import("expo-print")
type ExpoSharing = typeof import("expo-sharing")
type ExpoFileSystem = typeof import("expo-file-system/legacy")

function loadPrint(): ExpoPrint | null {
  try {
    return require("expo-print") as ExpoPrint
  } catch {
    return null
  }
}

function loadSharing(): ExpoSharing | null {
  try {
    return require("expo-sharing") as ExpoSharing
  } catch {
    return null
  }
}

function loadFileSystem(): ExpoFileSystem | null {
  try {
    return require("expo-file-system/legacy") as ExpoFileSystem
  } catch {
    return null
  }
}

type LabelMime = "application/pdf" | "image/png" | "image/jpeg"

type CachedSaleLabel = {
  uri: string
  mimeType: LabelMime
}

let memory: { key: string; file: CachedSaleLabel } | null = null

function isCanceled(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes("cancel") || message.includes("dismiss") || message.includes("did not start")
}

function isUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes("unavailab") || message.includes("native module") || message.includes("not found")
}

function labelMime(value: string | null | undefined, fallback: LabelMime): LabelMime {
  const mime = value?.split(";")[0]?.trim().toLowerCase() ?? ""
  if (mime.includes("pdf")) return "application/pdf"
  if (mime.includes("png")) return "image/png"
  if (mime.includes("jpeg") || mime.includes("jpg")) return "image/jpeg"
  return fallback
}

function utiFor(mimeType: LabelMime): string {
  if (mimeType === "application/pdf") return "com.adobe.pdf"
  if (mimeType === "image/jpeg") return "public.jpeg"
  return "public.png"
}

function cachePath(FileSystem: ExpoFileSystem, ext: "pdf" | "png" | "jpeg"): string {
  const dir = FileSystem.cacheDirectory
  if (!dir) throw new Error("Unable to save the shipping label on this device")
  return `${dir}reswell-shipping-label.${ext}`
}

async function fileLooksValid(FileSystem: ExpoFileSystem, uri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri)
  return info.exists && !info.isDirectory && info.size > 500
}

async function downloadLabel(
  FileSystem: ExpoFileSystem,
  url: string,
  dest: string,
  fallback: LabelMime,
  headers?: Record<string, string>,
): Promise<CachedSaleLabel | null> {
  try {
    const result = await FileSystem.downloadAsync(url, dest, headers ? { headers } : undefined)
    if (result.status < 200 || result.status >= 300) return null
    if (!(await fileLooksValid(FileSystem, result.uri))) return null
    return { uri: result.uri, mimeType: labelMime(result.mimeType, fallback) }
  } catch {
    return null
  }
}

async function cacheSaleLabelFile(
  FileSystem: ExpoFileSystem,
  accessToken: string,
  orderId: string,
): Promise<CachedSaleLabel> {
  const key = `${orderId}:${accessToken.slice(-12)}`
  if (memory?.key === key && (await fileLooksValid(FileSystem, memory.file.uri))) return memory.file

  try {
    const { url } = await fetchSaleLabel(accessToken, orderId)
    const pdf = await downloadLabel(FileSystem, url, cachePath(FileSystem, "pdf"), "application/pdf")
    if (pdf) {
      memory = { key, file: pdf }
      return pdf
    }
  } catch {
    // Fall through to the authenticated PNG preview.
  }

  const image = await downloadLabel(
    FileSystem,
    saleLabelImageUrl(orderId),
    cachePath(FileSystem, "png"),
    "image/png",
    { Authorization: `Bearer ${accessToken}` },
  )
  if (!image) throw new Error(LABEL_DOWNLOAD_ERROR)
  memory = { key, file: image }
  return image
}

async function openRemoteLabel(accessToken: string, orderId: string): Promise<void> {
  const { url } = await fetchSaleLabel(accessToken, orderId)
  await Linking.openURL(url)
}

async function shareCachedLabel(file: CachedSaleLabel): Promise<void> {
  const Sharing = loadSharing()
  try {
    if (Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(file.uri, {
        mimeType: file.mimeType,
        UTI: utiFor(file.mimeType),
        dialogTitle: "Share shipping label",
      })
      return
    }
  } catch (error) {
    if (isCanceled(error)) return
    if (!isUnavailable(error)) throw error
  }

  if (Platform.OS === "ios") {
    await Share.share({ url: file.uri })
    return
  }

  throw new Error(LABEL_SHARE_ERROR)
}

async function printCachedLabel(FileSystem: ExpoFileSystem, file: CachedSaleLabel): Promise<void> {
  const Print = loadPrint()
  if (!Print) {
    throw new Error("Cannot find native module 'ExpoPrint'")
  }

  if (file.mimeType === "application/pdf") {
    await Print.printAsync({ uri: file.uri })
    return
  }

  const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 })
  await Print.printAsync({
    html: `<html><body style="margin:0;padding:0"><img src="data:${file.mimeType};base64,${base64}" width="100%" /></body></html>`,
    width: 288,
    height: 432,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  })
}

/** Opens the system share sheet with the printable shipping label. */
export async function shareSaleLabel(accessToken: string, orderId: string): Promise<void> {
  if (Platform.OS === "web") {
    await openRemoteLabel(accessToken, orderId)
    return
  }

  const FileSystem = loadFileSystem()
  try {
    if (FileSystem) {
      await shareCachedLabel(await cacheSaleLabelFile(FileSystem, accessToken, orderId))
      return
    }
  } catch (error) {
    if (isCanceled(error)) return
  }

  try {
    await openRemoteLabel(accessToken, orderId)
  } catch {
    throw new Error(LABEL_SHARE_ERROR)
  }
}

/** Opens the native print dialog for the shipping label. */
export async function printSaleLabel(accessToken: string, orderId: string): Promise<void> {
  if (Platform.OS === "web") {
    await openRemoteLabel(accessToken, orderId)
    return
  }

  const FileSystem = loadFileSystem()
  try {
    if (FileSystem) {
      const file = await cacheSaleLabelFile(FileSystem, accessToken, orderId)
      try {
        await printCachedLabel(FileSystem, file)
        return
      } catch (error) {
        if (isCanceled(error)) return
        await shareCachedLabel(file)
        return
      }
    }
  } catch (error) {
    if (isCanceled(error)) return
  }

  try {
    await openRemoteLabel(accessToken, orderId)
  } catch {
    throw new Error(LABEL_PRINT_ERROR)
  }
}
