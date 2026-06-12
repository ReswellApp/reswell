"use server"

import { requestPasswordResetService } from "@/lib/services/passwordReset"

export async function requestPasswordResetAction(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const result = await requestPasswordResetService(raw)
  if ("error" in result) {
    return { error: result.error }
  }
  return { success: true }
}
