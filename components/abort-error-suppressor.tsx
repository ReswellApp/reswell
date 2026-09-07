"use client"

import { installAbortErrorSuppressor } from "@/lib/client/install-abort-error-suppressor"
import { installWebViewBridgeNoiseSuppressor } from "@/lib/client/install-webview-bridge-noise-suppressor"

installAbortErrorSuppressor()
installWebViewBridgeNoiseSuppressor()

export function AbortErrorSuppressor(): null {
  return null
}
