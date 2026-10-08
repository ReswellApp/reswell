import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import * as SecureStore from "expo-secure-store"

const CHUNK = 1800

/**
 * Supabase sessions are larger than the iOS Keychain item limit, so the
 * value is split across several SecureStore keys.
 */
const secureStore = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(`${key}.n`)
    if (!countRaw) return SecureStore.getItemAsync(key)
    const count = Number(countRaw)
    if (!Number.isFinite(count) || count <= 0) return null
    const parts: string[] = []
    for (let index = 0; index < count; index += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${index}`)
      if (part == null) return null
      parts.push(part)
    }
    return parts.join("")
  },
  async setItem(key: string, value: string): Promise<void> {
    const previous = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0)
    const chunks = Math.max(1, Math.ceil(value.length / CHUNK))
    for (let index = 0; index < chunks; index += 1) {
      await SecureStore.setItemAsync(
        `${key}.${index}`,
        value.slice(index * CHUNK, (index + 1) * CHUNK),
      )
    }
    for (let index = chunks; index < previous; index += 1) {
      await SecureStore.deleteItemAsync(`${key}.${index}`)
    }
    await SecureStore.setItemAsync(`${key}.n`, String(chunks))
  },
  async removeItem(key: string): Promise<void> {
    const count = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0)
    await SecureStore.deleteItemAsync(`${key}.n`)
    await SecureStore.deleteItemAsync(key)
    for (let index = 0; index < count; index += 1) {
      await SecureStore.deleteItemAsync(`${key}.${index}`)
    }
  },
}

let client: SupabaseClient | null | undefined

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    client = null
    return client
  }
  client = createClient(url, key, {
    auth: {
      storage: secureStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  })
  return client
}
