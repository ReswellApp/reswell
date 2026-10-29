import * as FileSystem from "expo-file-system/legacy"
import { emptySellDraft, type SellDraft } from "@/lib/sell-flow"

function draftFile(): string {
  if (!FileSystem.documentDirectory) throw new Error("Draft storage is unavailable")
  return `${FileSystem.documentDirectory}sell-listing-draft.json`
}

export async function saveSellDraft(draft: SellDraft): Promise<void> {
  await FileSystem.writeAsStringAsync(draftFile(), JSON.stringify(draft))
}

export async function loadSellDraft(): Promise<SellDraft | null> {
  const file = draftFile()
  const info = await FileSystem.getInfoAsync(file)
  if (!info.exists) return null
  const raw = await FileSystem.readAsStringAsync(file)
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object") return null
  const draft = { ...emptySellDraft(), ...(parsed as Partial<SellDraft>) }
  if (!Array.isArray(draft.photos)) draft.photos = []
  if (!draft.video || typeof draft.video !== "object" || typeof draft.video.uri !== "string") {
    draft.video = null
  }
  if (typeof draft.serverDraftId !== "string") draft.serverDraftId = ""
  return draft
}

export async function clearSellDraft(): Promise<void> {
  const file = draftFile()
  const info = await FileSystem.getInfoAsync(file)
  if (info.exists) await FileSystem.deleteAsync(file)
}
