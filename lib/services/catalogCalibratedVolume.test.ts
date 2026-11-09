import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  catalogDimensionDistance,
  catalogPointFromLabels,
  estimateVolumeFromCatalogCalibration,
  evaluateCatalogVolumeLeaveOneOut,
  scaleStockVolumeToDims,
  type CatalogVolumeCalibrationPoint,
} from "@/lib/services/catalogCalibratedVolume"

function point(
  partial: Partial<CatalogVolumeCalibrationPoint> &
    Pick<
      CatalogVolumeCalibrationPoint,
      "id" | "lengthInches" | "widthInches" | "thicknessInches" | "volumeLiters"
    >,
): CatalogVolumeCalibrationPoint {
  const shapeFactor =
    partial.volumeLiters /
    (partial.lengthInches * partial.widthInches * partial.thicknessInches * 0.016387064)
  return {
    brandId: "brand-a",
    brandModelId: "model-a",
    brandName: "Test Brand",
    brandSlug: "test-brand",
    modelName: "Test Model",
    boardCategorySlug: "shortboard",
    lengthLabel: "",
    widthLabel: "",
    thicknessLabel: "",
    volumeLabel: "",
    shapeFactor: Math.round(shapeFactor * 1000) / 1000,
    ...partial,
  }
}

describe("catalogPointFromLabels", () => {
  it("parses stock labels into a calibration point", () => {
    const parsed = catalogPointFromLabels({
      id: "1",
      brandId: "b",
      brandModelId: "m",
      brandName: "Firewire",
      brandSlug: "firewire",
      modelName: "Sweet Potato",
      boardCategorySlug: "groveler",
      lengthLabel: "5'10",
      widthLabel: "21 1/2",
      thicknessLabel: "2 5/8",
      volumeLabel: "36.5L",
    })
    assert.ok(parsed)
    assert.equal(parsed!.lengthInches, 70)
    assert.equal(parsed!.widthInches, 21.5)
    assert.equal(parsed!.thicknessInches, 2.625)
    assert.equal(parsed!.volumeLiters, 36.5)
    assert.ok(parsed!.shapeFactor > 0.4 && parsed!.shapeFactor < 0.8)
  })
})

describe("estimateVolumeFromCatalogCalibration", () => {
  it("scales a nearby custom from same-model stock shape factor", () => {
    const corpus = [
      point({
        id: "s1",
        lengthInches: 72,
        widthInches: 19.5,
        thicknessInches: 2.5,
        volumeLiters: 29.0,
      }),
      point({
        id: "s2",
        lengthInches: 74,
        widthInches: 19.75,
        thicknessInches: 2.5,
        volumeLiters: 30.5,
      }),
    ]

    const custom = {
      lengthInches: 73,
      widthInches: 19.625,
      thicknessInches: 2.5,
    }

    const fromNearest = scaleStockVolumeToDims(corpus[0]!, custom)
    const estimate = estimateVolumeFromCatalogCalibration(custom, corpus, {
      brandModelId: "model-a",
      k: 2,
    })

    assert.ok(estimate)
    assert.equal(estimate!.scope, "model")
    assert.ok(Math.abs(estimate!.liters - fromNearest) < 1.5)
    assert.ok(estimate!.litersDisplay > 28 && estimate!.litersDisplay < 32)
  })

  it("ranks closer dimensions first", () => {
    const a = { lengthInches: 72, widthInches: 19.5, thicknessInches: 2.5 }
    const near = { lengthInches: 72.5, widthInches: 19.5, thicknessInches: 2.5 }
    const far = { lengthInches: 80, widthInches: 21, thicknessInches: 2.75 }
    assert.ok(catalogDimensionDistance(a, near) < catalogDimensionDistance(a, far))
  })
})

describe("evaluateCatalogVolumeLeaveOneOut", () => {
  it("reports low error when a model has consistent shape factors", () => {
    const sf = 0.54
    const sizes = [
      { id: "a", L: 70, W: 19.25, T: 2.375 },
      { id: "b", L: 72, W: 19.5, T: 2.5 },
      { id: "c", L: 74, W: 19.75, T: 2.5 },
      { id: "d", L: 76, W: 20, T: 2.625 },
    ]
    const corpus = sizes.map((s) =>
      point({
        id: s.id,
        lengthInches: s.L,
        widthInches: s.W,
        thicknessInches: s.T,
        volumeLiters:
          Math.round(s.L * s.W * s.T * sf * 0.016387064 * 10) / 10,
      }),
    )

    const report = evaluateCatalogVolumeLeaveOneOut(corpus, { k: 3 })
    assert.ok(report.sampleSize >= 3)
    assert.ok(report.medianAbsErrorLiters <= 0.5)
    assert.ok(report.withinOneLiterPct >= 75)
  })
})
