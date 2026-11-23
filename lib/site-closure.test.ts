import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  closurePostAuthPath,
  shouldServeSiteClosurePage,
} from "./site-closure.ts"

function wall(pathname: string, init?: { method?: string; search?: string; isServerAction?: boolean }): boolean {
  return shouldServeSiteClosurePage({
    method: init?.method ?? "GET",
    pathname,
    searchParams: new URLSearchParams(init?.search ?? ""),
    isServerAction: init?.isServerAction ?? false,
  })
}

describe("site closure wall", () => {
  it("serves the shutdown page for the public marketplace and unknown URLs", () => {
    assert.equal(wall("/"), true)
    assert.equal(wall("/boards"), true)
    assert.equal(wall("/sell"), true)
    assert.equal(wall("/search"), true)
    assert.equal(wall("/this-page-does-not-exist"), true)
    assert.equal(wall("/messages"), true)
    assert.equal(wall("/dashboard/listings"), true)
    assert.equal(wall("/auth/sign-up"), true)
    assert.equal(wall("/auth/sign-up-success"), true)
    assert.equal(wall("/auth/google-sign-up-success"), true)
  })

  it("leaves sign-in, account records, admin, and service routes alone", () => {
    assert.equal(wall("/closed"), false)
    assert.equal(wall("/auth/login"), false)
    assert.equal(wall("/auth/forgot-password"), false)
    assert.equal(wall("/auth/update-password"), false)
    assert.equal(wall("/auth/callback"), false)
    assert.equal(wall("/auth/paypal/popup-close"), false)
    assert.equal(wall("/dashboard"), false)
    assert.equal(wall("/dashboard/sales"), false)
    assert.equal(wall("/dashboard/sales/order-1"), false)
    assert.equal(wall("/dashboard/purchases"), false)
    assert.equal(wall("/dashboard/purchases/order-1"), false)
    assert.equal(wall("/dashboard/earnings"), false)
    assert.equal(wall("/dashboard/earnings/cashout"), false)
    assert.equal(wall("/dashboard/profile"), false)
    assert.equal(wall("/dashboard/profile/team"), false)
    assert.equal(wall("/dashboard/orders/order-1"), false)
    assert.equal(wall("/dashboard/team"), false)
    assert.equal(wall("/seller/payouts"), false)
    assert.equal(wall("/admin/home"), false)
    assert.equal(wall("/api/mobile/v1/me/earnings"), false)
    assert.equal(wall("/media/listings/user/photo.jpg"), false)
    assert.equal(wall("/ingest/e"), false)
  })

  it("does not interrupt auth handoffs or mutations", () => {
    assert.equal(wall("/", { search: "code=abc" }), false)
    assert.equal(wall("/", { search: "token_hash=abc&type=recovery" }), false)
    assert.equal(wall("/sell", { method: "POST" }), false)
    assert.equal(wall("/sell", { isServerAction: true }), false)
  })

  it("keeps the shutdown page static and cacheable", async () => {
    const page = await readFile(new URL("../app/closed/page.tsx", import.meta.url), "utf8")
    const proxy = await readFile(new URL("../proxy.ts", import.meta.url), "utf8")
    assert.match(page, /export const dynamic = "force-static"/)
    assert.doesNotMatch(page, /getCachedRequestSession/)
    assert.match(proxy, /PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL/)
    assert.doesNotMatch(proxy, /CDN-Cache-Control', 'no-store'/)
  })

  it("sends sign-in back to sales when the requested page is closed", () => {
    assert.equal(closurePostAuthPath(null), "/dashboard/sales")
    assert.equal(closurePostAuthPath("/"), "/dashboard/sales")
    assert.equal(closurePostAuthPath("/sell/boards"), "/dashboard/sales")
    assert.equal(closurePostAuthPath("/dashboard/earnings?view=available"), "/dashboard/earnings?view=available")
    assert.equal(closurePostAuthPath("/admin/home"), "/admin/home")
  })
})
