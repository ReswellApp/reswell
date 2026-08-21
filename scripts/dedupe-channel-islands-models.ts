/**
 * Deduplicate Channel Islands `brand_models` near-duplicates and scrape junk.
 *
 * Merges alternate spellings / construction SKUs into the canonical CI model
 * (repoints listings + variants), then deletes the extras.
 *
 * Usage:
 *   npx tsx scripts/dedupe-channel-islands-models.ts [--dry-run]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  CHANNEL_ISLANDS_BRAND_SLUG,
  CHANNEL_ISLANDS_MODEL_NAME_ALIASES,
} from "@/lib/services/channelIslandsSurfboardCatalogJson"
import { deleteSellCatalogDocument, syncSellCatalogModelToIndex } from "@/lib/elasticsearch/sell-catalog-index"

type CatalogModelRow = {
  id: string
  name: string
  description: string | null
  image_url: string | null
}

/** Explicit remove → keep pairs beyond the shared alias map (construction SKUs, junk). */
const EXTRA_MERGE_INTO: ReadonlyArray<{ remove: string; keep: string }> = [
  { remove: "Better Everyday Spinetek", keep: "Better Everyday" },
  { remove: "Dumpster Diver 2 SpineTek", keep: "Dumpster Diver 2" },
  { remove: "G Skate SpineTek", keep: "G Skate" },
  { remove: "The Solution ECT EPOXY", keep: "The Solution" },
  { remove: "The Solution Spinetek", keep: "The Solution" },
  { remove: "X-Lite Pod Mod Black", keep: "Pod Mod" },
]

const DELETE_NAMES = ["The", "Single Fin"] as const

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  try {
    const content = readFileSync(filePath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!value) continue
      if (process.env[key]?.trim()) continue
      process.env[key] = value
    }
  } catch {
    // optional env file
  }
}

function resolveEnv(): { url: string; key: string } {
  loadEnvFile(".env.local")
  loadEnvFile(".env")
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.Next_Public_Supabase_Url ||
    ""
  ).trim()
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.Supabase_Service_Role_Key ||
    ""
  ).trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return { url, key }
}

async function resolveBrandId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", CHANNEL_ISLANDS_BRAND_SLUG)
    .maybeSingle()

  if (error || !data?.id) {
    throw new Error(`Brand not found for slug "${CHANNEL_ISLANDS_BRAND_SLUG}"`)
  }
  return data.id
}

function buildMergePlan(models: CatalogModelRow[]): Array<{ remove: CatalogModelRow; keep: CatalogModelRow }> {
  const byLower = new Map<string, CatalogModelRow>()
  for (const model of models) {
    byLower.set(model.name.trim().toLowerCase(), model)
  }

  const plan: Array<{ remove: CatalogModelRow; keep: CatalogModelRow }> = []
  const seenRemoveIds = new Set<string>()

  const pairs: Array<{ removeName: string; keepName: string }> = [
    ...Object.entries(CHANNEL_ISLANDS_MODEL_NAME_ALIASES).map(([alias, keepName]) => ({
      removeName: alias,
      keepName,
    })),
    ...EXTRA_MERGE_INTO.map((p) => ({ removeName: p.remove, keepName: p.keep })),
  ]

  for (const { removeName, keepName } of pairs) {
    const remove = byLower.get(removeName.trim().toLowerCase())
    const keep = byLower.get(keepName.trim().toLowerCase())
    if (!remove || !keep) continue
    if (remove.id === keep.id) continue
    if (seenRemoveIds.has(remove.id)) continue
    seenRemoveIds.add(remove.id)
    plan.push({ remove, keep })
  }

  return plan
}

async function repointBrandModelReferences(
  supabase: SupabaseClient,
  fromId: string,
  toId: string,
  dryRun: boolean,
): Promise<void> {
  if (fromId === toId) return

  const tables = [
    { table: "listings", column: "brand_model_id" },
    { table: "listing_brand_model_autofills", column: "brand_model_id" },
    { table: "crm_board_interests", column: "brand_model_id" },
    { table: "price_guide_entries", column: "brand_model_id" },
  ] as const

  for (const { table, column } of tables) {
    if (dryRun) continue
    const { error } = await supabase.from(table).update({ [column]: toId }).eq(column, fromId)
    if (error && !/does not exist|Could not find/i.test(error.message)) {
      console.warn(`[dedupe ci] ${table} repoint failed: ${error.message}`)
    }
  }
}

async function moveVariants(
  supabase: SupabaseClient,
  fromId: string,
  toId: string,
  dryRun: boolean,
): Promise<{ moved: number; dropped: number }> {
  if (fromId === toId) return { moved: 0, dropped: 0 }

  const { data: variants, error } = await supabase
    .from("brand_model_variants")
    .select("id")
    .eq("brand_model_id", fromId)

  if (error) {
    console.warn(`[dedupe ci] variant load failed: ${error.message}`)
    return { moved: 0, dropped: 0 }
  }

  let moved = 0
  let dropped = 0
  for (const variant of variants ?? []) {
    if (dryRun) {
      moved += 1
      continue
    }
    const { error: updateError } = await supabase
      .from("brand_model_variants")
      .update({ brand_model_id: toId })
      .eq("id", variant.id)

    if (!updateError) {
      moved += 1
      continue
    }

    // Unique dim collision on keep — drop the duplicate variant.
    if (/duplicate|23505/i.test(updateError.message)) {
      const { error: deleteError } = await supabase
        .from("brand_model_variants")
        .delete()
        .eq("id", variant.id)
      if (deleteError) {
        console.warn(`[dedupe ci] variant drop failed (${variant.id}): ${deleteError.message}`)
      } else {
        dropped += 1
      }
      continue
    }

    console.warn(`[dedupe ci] variant move failed (${variant.id}): ${updateError.message}`)
  }

  return { moved, dropped }
}

async function enrichKeepFromRemove(
  supabase: SupabaseClient,
  keep: CatalogModelRow,
  remove: CatalogModelRow,
  dryRun: boolean,
): Promise<void> {
  const patch: { description?: string; image_url?: string } = {}
  if (!keep.description?.trim() && remove.description?.trim()) {
    patch.description = remove.description
  }
  if (!keep.image_url?.trim() && remove.image_url?.trim()) {
    patch.image_url = remove.image_url
  }
  if (Object.keys(patch).length === 0) return
  if (dryRun) return

  const { error } = await supabase.from("brand_models").update(patch).eq("id", keep.id)
  if (error) {
    console.warn(`[dedupe ci] enrich keep failed (${keep.name}): ${error.message}`)
  }
}

/**
 * When the canonical name row is empty but the typo/alternate has variants,
 * delete the empty keep and rename the alternate into the canonical name.
 */
async function preferRenameWhenKeepEmpty(
  supabase: SupabaseClient,
  remove: CatalogModelRow,
  keep: CatalogModelRow,
  dryRun: boolean,
): Promise<"renamed" | "merge" | null> {
  const { count: keepVariantCount, error: keepErr } = await supabase
    .from("brand_model_variants")
    .select("id", { count: "exact", head: true })
    .eq("brand_model_id", keep.id)

  const { count: removeVariantCount, error: removeErr } = await supabase
    .from("brand_model_variants")
    .select("id", { count: "exact", head: true })
    .eq("brand_model_id", remove.id)

  if (keepErr || removeErr) return "merge"

  const keepCount = keepVariantCount ?? 0
  const removeCount = removeVariantCount ?? 0
  if (keepCount > 0 || removeCount === 0) return "merge"

  // Empty keep, populated remove → rename remove to canonical, delete empty keep.
  if (dryRun) return "renamed"

  await repointBrandModelReferences(supabase, keep.id, remove.id, false)

  const { error: deleteKeepError } = await supabase.from("brand_models").delete().eq("id", keep.id)
  if (deleteKeepError) {
    console.warn(`[dedupe ci] delete empty keep failed (${keep.name}): ${deleteKeepError.message}`)
    return null
  }

  const { error: renameError } = await supabase
    .from("brand_models")
    .update({
      name: keep.name,
      description: remove.description?.trim() || keep.description,
      image_url: remove.image_url?.trim() || keep.image_url,
    })
    .eq("id", remove.id)

  if (renameError) {
    console.warn(`[dedupe ci] rename failed (${remove.name} → ${keep.name}): ${renameError.message}`)
    return null
  }

  void deleteSellCatalogDocument("model", keep.id)
  void syncSellCatalogModelToIndex(supabase, remove.id)
  return "renamed"
}

async function deleteModel(
  supabase: SupabaseClient,
  model: CatalogModelRow,
  dryRun: boolean,
): Promise<boolean> {
  if (dryRun) return true
  const { error } = await supabase.from("brand_models").delete().eq("id", model.id)
  if (error) {
    console.warn(`[dedupe ci] delete failed (${model.name}): ${error.message}`)
    return false
  }
  void deleteSellCatalogDocument("model", model.id)
  return true
}

async function dedupe(supabase: SupabaseClient, dryRun: boolean): Promise<void> {
  const brandId = await resolveBrandId(supabase)
  const { data: models, error } = await supabase
    .from("brand_models")
    .select("id, name, description, image_url")
    .eq("brand_id", brandId)
    .order("name")

  if (error || !models) {
    throw new Error(error?.message ?? "Failed to load Channel Islands models")
  }

  const rows = models as CatalogModelRow[]
  const plan = buildMergePlan(rows)

  console.log(
    JSON.stringify(
      {
        brandId,
        brandSlug: CHANNEL_ISLANDS_BRAND_SLUG,
        dryRun,
        modelCount: rows.length,
        mergeCount: plan.length,
        deleteNames: DELETE_NAMES,
      },
      null,
      2,
    ),
  )

  let merged = 0
  let renamed = 0
  let deleted = 0
  const keptIds = new Set<string>()

  for (const { remove, keep } of plan) {
    console.log(`merge: "${remove.name}" → "${keep.name}"`)
    const mode = await preferRenameWhenKeepEmpty(supabase, remove, keep, dryRun)
    if (mode === "renamed") {
      renamed += 1
      keptIds.add(remove.id)
      continue
    }
    if (mode === null) continue

    await enrichKeepFromRemove(supabase, keep, remove, dryRun)
    await repointBrandModelReferences(supabase, remove.id, keep.id, dryRun)
    const { moved, dropped } = await moveVariants(supabase, remove.id, keep.id, dryRun)
    if (moved || dropped) {
      console.log(`  variants moved=${moved} dropped=${dropped}`)
    }
    const ok = await deleteModel(supabase, remove, dryRun)
    if (ok) {
      merged += 1
      keptIds.add(keep.id)
    }
  }

  const byLower = new Map(rows.map((m) => [m.name.trim().toLowerCase(), m]))
  for (const name of DELETE_NAMES) {
    const row = byLower.get(name.toLowerCase())
    if (!row) continue
    console.log(`delete junk: "${row.name}"`)
    if (await deleteModel(supabase, row, dryRun)) deleted += 1
  }

  if (!dryRun) {
    for (const id of keptIds) {
      void syncSellCatalogModelToIndex(supabase, id)
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        merged,
        renamed,
        deletedJunk: deleted,
        remainingEstimate: rows.length - merged - renamed - deleted,
      },
      null,
      2,
    ),
  )
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run")
  const { url, key } = resolveEnv()
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  await dedupe(supabase, dryRun)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
