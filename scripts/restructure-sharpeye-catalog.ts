/**
 * Restructure Sharp Eye catalog rows that were imported as separate models per material
 * (e.g. `INFERNO 72 (E3 LITE)`) into one model with material variants underneath.
 *
 * Usage:
 *   npx tsx scripts/restructure-sharpeye-catalog.ts [--dry-run]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { insertBrandModel } from "@/lib/db/brand-models"
import { insertBrandModelVariant, maxSortOrderForBrandModel } from "@/lib/db/brand-model-variants"
import {
  BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
  BRAND_MODEL_VARIANT_DEFAULT_FIN_BOX_TYPE,
} from "@/lib/validations/brand-model-variants"
import {
  mapSharpEyeMaterialLabel,
  parseSharpEyeProductName,
  SHARP_EYE_BRAND_SLUG,
} from "@/lib/services/sharpEyeSurfboardCatalogJson"

type CatalogModelRow = {
  id: string
  name: string
  description: string | null
  image_url: string | null
}

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
  ] as const

  for (const { table, column } of tables) {
    if (dryRun) continue
    const { error } = await supabase.from(table).update({ [column]: toId }).eq(column, fromId)
    if (error && !error.message.includes("does not exist")) {
      console.warn(`[restructure sharp eye] ${table} repoint failed: ${error.message}`)
    }
  }
}

async function upsertMaterialVariantFromModel(
  supabase: SupabaseClient,
  brandId: string,
  modelId: string,
  source: CatalogModelRow,
  materialLabel: string,
  material: ReturnType<typeof mapSharpEyeMaterialLabel>,
  sortOrder: number,
  dryRun: boolean,
): Promise<"created" | "updated" | "skipped"> {
  if (dryRun) return "created"

  const insertResult = await insertBrandModelVariant(supabase, {
    brand_id: brandId,
    brand_model_id: modelId,
    length_label: "",
    width_label: "",
    thickness_label: "",
    volume_label: "",
    fin_box_type: BRAND_MODEL_VARIANT_DEFAULT_FIN_BOX_TYPE,
    fin_boxes: BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
    material,
    condition: "brand_new",
    configuration_label: materialLabel,
    product_category_slug: "surfboards",
    price: null,
    image_url: source.image_url,
    sort_order: sortOrder,
  })

  if (insertResult.ok) return "created"

  if (insertResult.code === "23505") {
    const { data: existing, error } = await supabase
      .from("brand_model_variants")
      .select("id, image_url")
      .eq("brand_model_id", modelId)
      .eq("material", material)
      .eq("condition", "brand_new")
      .eq("length_label", "")
      .eq("width_label", "")
      .eq("thickness_label", "")
      .eq("volume_label", "")
      .maybeSingle()

    if (error || !existing?.id) return "skipped"

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      configuration_label: materialLabel,
    }
    if (source.image_url?.trim()) {
      updates.image_url = source.image_url
    }

    const { error: updateError } = await supabase
      .from("brand_model_variants")
      .update(updates)
      .eq("id", existing.id)

    return updateError ? "skipped" : "updated"
  }

  return "skipped"
}

async function restructure(supabase: SupabaseClient, brandId: string, dryRun: boolean): Promise<void> {
  const { data: models, error } = await supabase
    .from("brand_models")
    .select("id, name, description, image_url")
    .eq("brand_id", brandId)
    .order("name")

  if (error || !models) {
    throw new Error(error?.message ?? "Failed to load Sharp Eye models")
  }

  const rows = models as CatalogModelRow[]
  const byBase = new Map<string, CatalogModelRow[]>()

  for (const row of rows) {
    const parsed = parseSharpEyeProductName(row.name)
    const key = parsed.baseName.toLowerCase()
    const list = byBase.get(key) ?? []
    list.push(row)
    byBase.set(key, list)
  }

  let parentsEnsured = 0
  let variantsCreated = 0
  let variantsUpdated = 0
  let modelsDeleted = 0
  const errors: string[] = []

  for (const [, members] of byBase.entries()) {
    const parsedMembers = members.map((row) => ({
      row,
      parsed: parseSharpEyeProductName(row.name),
    }))

    const parentCandidate =
      parsedMembers.find((m) => !m.parsed.materialLabel)?.row ??
      parsedMembers[0]?.row ??
      null

    if (!parentCandidate) continue

    let parentId = parentCandidate.id
    const baseName = parseSharpEyeProductName(parentCandidate.name).baseName

    if (parentCandidate.name.trim().toLowerCase() !== baseName.toLowerCase()) {
      if (!dryRun) {
        const { data: existingParent, error: parentLookupError } = await supabase
          .from("brand_models")
          .select("id")
          .eq("brand_id", brandId)
          .ilike("name", baseName)
          .maybeSingle()

        if (parentLookupError) {
          errors.push(`Parent lookup failed (${baseName}): ${parentLookupError.message}`)
          continue
        }

        if (existingParent?.id) {
          parentId = existingParent.id
        } else {
          const insertResult = await insertBrandModel(supabase, {
            brand_id: brandId,
            name: baseName,
            description: parentCandidate.description,
            image_url: parentCandidate.image_url,
            product_category_slug: "surfboards",
          })
          if (!insertResult.ok) {
            errors.push(`Parent create failed (${baseName}): ${insertResult.error}`)
            continue
          }
          parentId = insertResult.row.id
          parentsEnsured++
        }
      } else {
        parentsEnsured++
      }
    }

    let sortOrder = dryRun ? 0 : await maxSortOrderForBrandModel(supabase, parentId)

    for (const member of parsedMembers) {
      const materialLabel = member.parsed.materialLabel ?? "PU/PE"
      sortOrder += 1
      const result = await upsertMaterialVariantFromModel(
        supabase,
        brandId,
        parentId,
        member.row,
        materialLabel,
        member.parsed.material,
        sortOrder,
        dryRun,
      )
      if (result === "created") variantsCreated++
      if (result === "updated") variantsUpdated++

      if (member.row.id !== parentId) {
        await repointBrandModelReferences(supabase, member.row.id, parentId, dryRun)
        if (!dryRun) {
          const { error: deleteError } = await supabase
            .from("brand_models")
            .delete()
            .eq("id", member.row.id)

          if (deleteError) {
            errors.push(`Delete failed (${member.row.name}): ${deleteError.message}`)
          } else {
            modelsDeleted++
          }
        } else {
          modelsDeleted++
        }
      } else if (!dryRun) {
        const { error: renameError } = await supabase
          .from("brand_models")
          .update({
            name: baseName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parentId)

        if (renameError) {
          errors.push(`Rename failed (${member.row.name}): ${renameError.message}`)
        }
      }
    }
  }

  if (!dryRun) {
    const { count, error: countError } = await supabase
      .from("brand_models")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)

    if (!countError && count != null) {
      await supabase.from("brands").update({ model_count: count }).eq("id", brandId)
    }
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        dryRun,
        baseKeys: byBase.size,
        parentsEnsured,
        variantsCreated,
        variantsUpdated,
        modelsDeleted,
        errorCount: errors.length,
        errors,
      },
      null,
      2,
    ),
  )
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const dryRun = process.argv.includes("--dry-run")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(url, key)
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", SHARP_EYE_BRAND_SLUG)
    .maybeSingle()

  if (error || !data?.id) {
    throw new Error(`Brand not found for slug "${SHARP_EYE_BRAND_SLUG}"`)
  }

  await restructure(supabase, data.id, dryRun)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
