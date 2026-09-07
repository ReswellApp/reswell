import type { GiveawayEntry, GiveawayPrizeBrandId } from "@/lib/types/giveaways"

export async function submitGiveawayEntry(opts: {
  slug: string
  preferredBrand?: GiveawayPrizeBrandId | null
  signedUpFromCta?: boolean
}): Promise<{ ok: boolean; entry?: GiveawayEntry; error?: string }> {
  try {
    const res = await fetch(`/api/giveaways/${encodeURIComponent(opts.slug)}/entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferredBrand: opts.preferredBrand ?? null,
        signedUpFromCta: opts.signedUpFromCta === true,
      }),
    })
    const json = (await res.json()) as {
      data?: { entry?: GiveawayEntry }
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: json.error ?? "Could not save your entry." }
    }
    return { ok: true, entry: json.data?.entry }
  } catch {
    return { ok: false, error: "Network error. Try again." }
  }
}
