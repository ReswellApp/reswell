import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { KLAVIYO_EMAIL_PALETTE } from "@/lib/klaviyo/email-brand-styles"
import { sanitizeEmailHtml } from "./brand-html"

describe("email html brand lock", () => {
  it("rewrites hex, rgb, and named colors onto the palette", () => {
    const html = sanitizeEmailHtml(
      '<table bgcolor="red"><tr><td style="color:rgb(255, 0, 0);background:#00ff00">Hi</td></tr></table>',
    )
    assert.doesNotMatch(html, /#FF0000|#00ff00|red|rgb\(/i)
    for (const match of html.match(/#[0-9A-Fa-f]{6}/g) ?? []) {
      assert.ok((KLAVIYO_EMAIL_PALETTE as readonly string[]).includes(match.toUpperCase()))
    }
  })

  it("rewrites font-family to Stack Sans", () => {
    const html = sanitizeEmailHtml('<style>p{font-family:Comic Sans MS, cursive;color:#fff}</style>')
    assert.match(html, /font-family:"Stack Sans Text", Arial, Helvetica, sans-serif/)
    assert.doesNotMatch(html, /Comic Sans/)
    assert.match(html, /#FFFFFF/)
  })
})
