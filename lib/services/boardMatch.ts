import type { SupabaseClient } from "@supabase/supabase-js"

import {
  listBoardMatchBrandsByIds,
  listBoardMatchListingCandidates,
  listBoardMatchModelsByIds,
  listBoardMatchModelsForBrandIds,
  type BoardMatchBrandRef,
  type BoardMatchModelRef,
} from "@/lib/db/boardMatch"
import type {
  BoardMatchBrandOption,
  BoardMatchCard,
  BoardMatchModelOption,
} from "@/lib/types/boardMatch"

export const BOARD_MATCH_ROUND_SIZE = 8
export const BOARD_MATCH_MIN_CARDS = 4
const BRAND_CHOICE_COUNT = 4
const MODEL_CHOICE_COUNT = 4

function shuffleInPlace<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = items[i]!
    items[i] = items[j]!
    items[j] = tmp
  }
  return items
}

function pickDiverseCandidates<T extends { brandId: string }>(
  rows: T[],
  size: number,
  random: () => number,
): T[] {
  const shuffled = shuffleInPlace([...rows], random)
  const picked: T[] = []
  const usedBrands = new Set<string>()

  for (const row of shuffled) {
    if (picked.length >= size) break
    if (usedBrands.has(row.brandId)) continue
    usedBrands.add(row.brandId)
    picked.push(row)
  }

  // Fill remaining slots if we do not have enough unique brands.
  if (picked.length < size) {
    for (const row of shuffled) {
      if (picked.length >= size) break
      if (picked.some((p) => p === row)) continue
      picked.push(row)
    }
  }

  return picked
}

function brandOption(ref: BoardMatchBrandRef): BoardMatchBrandOption {
  return { id: ref.id, name: ref.name, slug: ref.slug }
}

function modelOption(ref: BoardMatchModelRef): BoardMatchModelOption {
  return { id: ref.id, name: ref.name }
}

function buildBrandChoices(
  correct: BoardMatchBrandRef,
  pool: BoardMatchBrandRef[],
  random: () => number,
): BoardMatchBrandOption[] {
  const distractors = shuffleInPlace(
    pool.filter((b) => b.id !== correct.id),
    random,
  ).slice(0, BRAND_CHOICE_COUNT - 1)

  const choices = shuffleInPlace([correct, ...distractors].map(brandOption), random)
  // Need a full set of choices; if pool is thin, pad is impossible — caller filters.
  return choices
}

function buildModelChoices(
  correct: BoardMatchModelRef,
  siblings: BoardMatchModelRef[],
  random: () => number,
): BoardMatchModelOption[] {
  const distractors = shuffleInPlace(
    siblings.filter((m) => m.id !== correct.id),
    random,
  ).slice(0, MODEL_CHOICE_COUNT - 1)

  return shuffleInPlace([correct, ...distractors].map(modelOption), random)
}

export type BoardMatchDeckResult = {
  cards: BoardMatchCard[]
  /** True when the catalog could not supply a playable round. */
  unavailable: boolean
}

/**
 * Build a Board Match round from live marketplace listings linked to the catalog.
 */
export async function loadBoardMatchDeck(
  supabase: SupabaseClient,
  options: {
    roundSize?: number
    random?: () => number
  } = {},
): Promise<BoardMatchDeckResult> {
  const roundSize = options.roundSize ?? BOARD_MATCH_ROUND_SIZE
  const random = options.random ?? Math.random

  const candidates = await listBoardMatchListingCandidates(supabase, { limit: 160 })
  if (candidates.length < BOARD_MATCH_MIN_CARDS) {
    return { cards: [], unavailable: true }
  }

  const brandIds = candidates.map((c) => c.brandId)
  const modelIds = candidates.map((c) => c.brandModelId)
  const [brandsById, modelsById, modelsByBrand] = await Promise.all([
    listBoardMatchBrandsByIds(supabase, brandIds),
    listBoardMatchModelsByIds(supabase, modelIds),
    listBoardMatchModelsForBrandIds(supabase, brandIds),
  ])

  const enriched = candidates.flatMap((row) => {
    const brand = brandsById.get(row.brandId)
    const model = modelsById.get(row.brandModelId)
    if (!brand || !model) return []
    if (model.brandId !== brand.id) return []
    const siblings = modelsByBrand.get(brand.id) ?? []
    // Need at least 2 model choices to make the bonus step meaningful.
    if (siblings.length < 2) return []
    return [{ ...row, brand, model, siblings }]
  })

  if (enriched.length < BOARD_MATCH_MIN_CARDS) {
    return { cards: [], unavailable: true }
  }

  const brandPool = [...brandsById.values()]
  if (brandPool.length < 2) {
    return { cards: [], unavailable: true }
  }

  const picked = pickDiverseCandidates(enriched, Math.min(roundSize, enriched.length), random)
  const cards: BoardMatchCard[] = []

  for (const row of picked) {
    const brandChoices = buildBrandChoices(row.brand, brandPool, random)
    if (brandChoices.length < 2) continue
    const modelChoices = buildModelChoices(row.model, row.siblings, random)
    if (modelChoices.length < 2) continue

    cards.push({
      id: `${row.listingId}:${row.brandModelId}`,
      listingId: row.listingId,
      listingSlug: row.listingSlug,
      imageUrl: row.imageUrl,
      brand: brandOption(row.brand),
      model: modelOption(row.model),
      brandChoices,
      modelChoices,
    })
  }

  if (cards.length < BOARD_MATCH_MIN_CARDS) {
    return { cards: [], unavailable: true }
  }

  return { cards, unavailable: false }
}

export function boardMatchBrandHref(brand: BoardMatchBrandOption | null): string {
  if (!brand?.slug) return "/brands"
  return `/brands/${encodeURIComponent(brand.slug)}`
}
