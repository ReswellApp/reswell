import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { layoutFieldDropdown } from "./below-field-dropdown-layout.ts"

const desktopViewport = {
  width: 1280,
  height: 800,
  offsetTop: 0,
  visualHeight: 800,
}

describe("layoutFieldDropdown", () => {
  it("pins the panel below the field and stretches to the field width when it is already wide enough", () => {
    const layout = layoutFieldDropdown(
      { top: 120, left: 40, bottom: 156, width: 320 },
      desktopViewport,
      { gap: 6, minListWidth: 240 },
    )
    assert.equal(layout.top, 162)
    assert.equal(layout.left, 40)
    assert.equal(layout.width, 320)
    assert.ok(layout.maxHeight >= 120)
  })

  it("keeps the panel below when flip is off even if space below is tight", () => {
    const layout = layoutFieldDropdown(
      { top: 700, left: 24, bottom: 736, width: 260 },
      desktopViewport,
      { gap: 6, minMaxHeight: 120, allowFlip: false },
    )
    assert.equal(layout.top, 742)
    assert.ok(layout.maxHeight >= 120)
  })

  it("flips above the field when there is not enough room below", () => {
    const layout = layoutFieldDropdown(
      { top: 720, left: 24, bottom: 756, width: 260 },
      desktopViewport,
      { gap: 6, minMaxHeight: 120, maxHeightCap: 280, allowFlip: true },
    )
    assert.ok(layout.top < 720)
    assert.ok(layout.top + layout.maxHeight <= 720)
    assert.ok(layout.maxHeight >= 120)
  })

  it("clamps width and left so the panel stays on screen", () => {
    const layout = layoutFieldDropdown(
      { top: 80, left: 1200, bottom: 116, width: 80 },
      desktopViewport,
      { gap: 6, minListWidth: 280, horizontalGutter: 16 },
    )
    assert.ok(layout.left + layout.width <= 1280 - 16)
    assert.ok(layout.width <= 280)
    assert.ok(layout.left >= 16)
  })
})
