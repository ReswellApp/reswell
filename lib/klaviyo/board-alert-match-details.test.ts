import assert from "node:assert/strict"
import { register } from "node:module"
import { before, describe, it } from "node:test"

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { pathToFileURL } from "node:url"
import { join } from "node:path"
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = join(${JSON.stringify("/workspace")}, specifier.slice(2))
    const file = abs.endsWith(".ts") ? abs : abs + ".ts"
    return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
`),
)

let boardAlertMatchFinderProperties: typeof import("./board-alert-match-details.ts").boardAlertMatchFinderProperties

before(async () => {
  ;({ boardAlertMatchFinderProperties } = await import("./board-alert-match-details.ts"))
})

const ORIGIN = "https://www.reswell.app"
const BRAND_ID = "11111111-1111-4111-8111-111111111111"
const MODEL_ID = "22222222-2222-4222-8222-222222222222"

describe("boardAlertMatchFinderProperties", () => {
  it("sends every Board Finder field, with brand and model links", () => {
    const props = boardAlertMatchFinderProperties(
      {
        source: "board-finder",
        alertKind: "search",
        section: "surfboards",
        brand: "Channel Islands",
        brandId: BRAND_ID,
        brandSlug: "channel-islands",
        model: "Happy Everyday",
        brandModelId: MODEL_ID,
        modelSlug: "happy-everyday",
        length: ["5-6-5-11"],
        style: ["shortboard"],
        conditions: ["excellent"],
        minPrice: 400,
        maxPrice: 900,
        volume: ["25-30"],
        construction: ["pu_poly"],
        finSystem: ["futures"],
      },
      ORIGIN,
    )

    assert.equal(props.Alert_Source, "board-finder")
    assert.equal(props.Board_Finder_URL, "https://www.reswell.app/board-finder")
    assert.equal(props.Wanted_Brand, "Channel Islands")
    assert.equal(props.Wanted_Brand_ID, BRAND_ID)
    assert.equal(props.Wanted_Brand_Slug, "channel-islands")
    assert.equal(props.Wanted_Model, "Happy Everyday")
    assert.equal(props.Wanted_Model_ID, MODEL_ID)
    assert.equal(props.Wanted_Model_Slug, "happy-everyday")
    assert.equal(props.Wanted_Size, `5'6" – 5'11"`)
    assert.equal(props.Wanted_Style, "Shortboard")
    assert.equal(props.Wanted_Condition, "Excellent")
    assert.equal(props.Wanted_Min_Price, 400)
    assert.equal(props.Wanted_Max_Price, 900)
    assert.equal(props.Wanted_Volume, "25L – 30L")
    assert.equal(props.Wanted_Construction, "PU/Poly")
    assert.equal(props.Wanted_Fin_System, "Futures")
    assert.equal(props.Brand_URL, "https://www.reswell.app/brands/channel-islands")
    assert.equal(props.Model_URL, "https://www.reswell.app/channel-islands/happy-everyday")
    assert.match(String(props.Search_URL), /^https:\/\/www\.reswell\.app\/boards\?/)
    assert.match(String(props.Search_URL), /brandId=11111111-1111-4111-8111-111111111111/)
    assert.match(String(props.Search_URL), /brandModelId=22222222-2222-4222-8222-222222222222/)
    assert.match(String(props.Search_URL), /length=5-6-5-11/)
    assert.match(String(props.Wanted_Summary), /Channel Islands/)
    assert.match(String(props.Wanted_Summary), /Happy Everyday/)
  })
})
