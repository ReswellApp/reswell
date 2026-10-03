import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LISTING_PDP_CROP_COVER,
  LISTING_PDP_CROP_FIT,
  applyListingPdpCropPan,
  applyListingPdpCropZoom,
  clampListingPdpCropLayout,
  isListingPdpCropDefault,
  listingPdpContainScale,
  listingPdpCoverScale,
  listingPdpCropCssFit,
  listingPdpCropFromImageRow,
  listingPdpCropNeedsPreciseLayout,
  listingPdpCropToLayout,
  listingPdpCropsEqual,
  listingPdpLayoutToCrop,
  listingPdpRenderScale,
  listingPdpZoomFromRenderScale,
  resolveListingPdpCrop,
} from "./listing-pdp-crop.ts"

describe("resolveListingPdpCrop", () => {
  it("keeps null columns as no seller crop", () => {
    assert.equal(resolveListingPdpCrop(null, null, null), null)
    assert.equal(listingPdpCropFromImageRow({}), null)
    assert.equal(isListingPdpCropDefault(null), true)
    assert.equal(isListingPdpCropDefault(LISTING_PDP_CROP_FIT), true)
    assert.equal(isListingPdpCropDefault(LISTING_PDP_CROP_COVER), false)
  })

  it("fills missing pieces when any crop column is set", () => {
    assert.deepEqual(resolveListingPdpCrop(0, null, null), LISTING_PDP_CROP_FIT)
    assert.deepEqual(resolveListingPdpCrop(null, 20, 80), { zoom: 1, x: 20, y: 80 })
  })

  it("clamps out-of-range values", () => {
    assert.deepEqual(resolveListingPdpCrop(9, -10, 140), { zoom: 4, x: 0, y: 100 })
  })
})

describe("listingPdp render scale", () => {
  const frame = { w: 300, h: 400 }
  const image = { w: 200, h: 400 }

  it("interpolates contain → cover between zoom 0 and 1", () => {
    const contain = listingPdpContainScale(frame.w, frame.h, image.w, image.h)
    const cover = listingPdpCoverScale(frame.w, frame.h, image.w, image.h)
    assert.equal(contain, 1)
    assert.equal(cover, 1.5)
    assert.equal(listingPdpRenderScale(frame.w, frame.h, image.w, image.h, 0), contain)
    assert.equal(listingPdpRenderScale(frame.w, frame.h, image.w, image.h, 1), cover)
    assert.ok(
      Math.abs(
        listingPdpRenderScale(frame.w, frame.h, image.w, image.h, 0.5) -
          (contain + 0.5 * (cover - contain)),
      ) < 1e-9,
    )
  })

  it("multiplies cover above zoom 1 and round-trips", () => {
    const cover = listingPdpCoverScale(frame.w, frame.h, image.w, image.h)
    const scale = listingPdpRenderScale(frame.w, frame.h, image.w, image.h, 2)
    assert.equal(scale, cover * 2)
    assert.ok(
      Math.abs(listingPdpZoomFromRenderScale(frame.w, frame.h, image.w, image.h, scale) - 2) <
        1e-9,
    )
  })
})

describe("listingPdpCropToLayout / listingPdpLayoutToCrop", () => {
  it("centers a cover crop", () => {
    const layout = listingPdpCropToLayout(300, 400, 300, 400, LISTING_PDP_CROP_COVER)
    assert.equal(layout.width, 300)
    assert.equal(layout.height, 400)
    assert.equal(layout.left, 0)
    assert.equal(layout.top, 0)
    assert.deepEqual(listingPdpLayoutToCrop(300, 400, 300, 400, layout), LISTING_PDP_CROP_COVER)
  })

  it("fits a tall board inside a 3:4 frame without cropping", () => {
    const layout = listingPdpCropToLayout(300, 400, 200, 500, LISTING_PDP_CROP_FIT)
    assert.ok(layout.width <= 300 + 1e-6)
    assert.ok(layout.height <= 400 + 1e-6)
    assert.ok(Math.abs(layout.left - (300 - layout.width) / 2) < 1e-6)
    assert.ok(Math.abs(layout.top - (400 - layout.height) / 2) < 1e-6)
    const back = listingPdpLayoutToCrop(300, 400, 200, 500, layout)
    assert.ok(Math.abs(back.zoom - 0) < 0.01)
  })

  it("round-trips a panned cover crop", () => {
    const crop = { zoom: 2, x: 20, y: 80 }
    const layout = listingPdpCropToLayout(300, 400, 600, 600, crop)
    const back = listingPdpLayoutToCrop(300, 400, 600, 600, layout)
    assert.ok(Math.abs(back.zoom - 2) < 0.01)
    assert.ok(Math.abs(back.x - 20) < 0.2)
    assert.ok(Math.abs(back.y - 80) < 0.2)
  })
})

describe("clamp and gestures", () => {
  it("centers an image smaller than the frame", () => {
    const clamped = clampListingPdpCropLayout(300, 400, {
      width: 150,
      height: 200,
      left: 0,
      top: 0,
    })
    assert.equal(clamped.left, 75)
    assert.equal(clamped.top, 100)
  })

  it("does not pan a fitted image off-center", () => {
    const fitted = listingPdpCropToLayout(300, 400, 200, 500, LISTING_PDP_CROP_FIT)
    const panned = applyListingPdpCropPan({
      layout: fitted,
      deltaX: 80,
      deltaY: -40,
      frameW: 300,
      frameH: 400,
    })
    assert.ok(Math.abs(panned.left - fitted.left) < 1e-6)
    assert.ok(Math.abs(panned.top - fitted.top) < 1e-6)
  })

  it("zooms around a pinch origin and stays clamped", () => {
    const start = listingPdpCropToLayout(300, 400, 300, 400, LISTING_PDP_CROP_COVER)
    const zoomed = applyListingPdpCropZoom({
      layout: start,
      factor: 2,
      originX: 150,
      originY: 200,
      frameW: 300,
      frameH: 400,
      imageW: 300,
      imageH: 400,
    })
    assert.ok(zoomed.width > start.width)
    assert.ok(zoomed.left <= 0)
    assert.ok(zoomed.top <= 0)
    assert.ok(zoomed.left + zoomed.width >= 300 - 1e-6)
    assert.ok(zoomed.top + zoomed.height >= 400 - 1e-6)
  })
})

describe("listingPdpCropCssFit", () => {
  it("uses contain only for an explicit fit crop", () => {
    assert.equal(listingPdpCropCssFit(null), "cover")
    assert.equal(listingPdpCropCssFit(LISTING_PDP_CROP_COVER), "cover")
    assert.equal(listingPdpCropCssFit(LISTING_PDP_CROP_FIT), "contain")
    assert.equal(listingPdpCropCssFit({ zoom: 1.4, x: 50, y: 40 }), "cover")
  })

  it("needs a measured layout only for intermediate zooms", () => {
    assert.equal(listingPdpCropNeedsPreciseLayout(null), false)
    assert.equal(listingPdpCropNeedsPreciseLayout(LISTING_PDP_CROP_FIT), false)
    assert.equal(listingPdpCropNeedsPreciseLayout(LISTING_PDP_CROP_COVER), false)
    assert.equal(listingPdpCropNeedsPreciseLayout({ zoom: 0.4, x: 50, y: 50 }), true)
    assert.equal(listingPdpCropsEqual(LISTING_PDP_CROP_FIT, null), true)
    assert.equal(listingPdpCropsEqual(LISTING_PDP_CROP_COVER, null), false)
  })
})
