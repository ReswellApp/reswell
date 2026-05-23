"use client"

import { installAbortErrorSuppressor } from "@/lib/client/install-abort-error-suppressor"

installAbortErrorSuppressor()

export function AbortErrorSuppressor(): null {
  return null
}
