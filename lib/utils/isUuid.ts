import { z } from "zod"

export function isUuidString(value: string | undefined | null): boolean {
  if (!value?.trim()) return false
  return z.string().uuid().safeParse(value.trim()).success
}
