/**
 * Self-contained Reswell shop MCP App (board picker + cart).
 * Hosts render this HTML in a sandboxed iframe (Claude / ChatGPT / Goose).
 */

export function buildReswellShopWidgetHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Reswell</title>
<style>
  :root {
    --ink: #0b1c24;
    --ink-2: #132a34;
    --foam: #e8f4f2;
    --mist: #9cb8b3;
    --tide: #2f8f7b;
    --tide-deep: #1f6b5c;
    --sand: #d7c4a8;
    --danger: #c45c4a;
    --radius: 14px;
    --font: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
    --sans: "Avenir Next", "Segoe UI", system-ui, sans-serif;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    min-height: 100%;
    background:
      radial-gradient(120% 80% at 10% -10%, rgba(47,143,123,0.28), transparent 55%),
      radial-gradient(90% 70% at 100% 0%, rgba(215,196,168,0.16), transparent 45%),
      linear-gradient(165deg, #07141a 0%, var(--ink) 42%, #102832 100%);
    color: var(--foam);
    font-family: var(--sans);
  }
  body {
    padding: 14px 14px 72px;
  }
  .brand {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .brand h1 {
    margin: 0;
    font-family: var(--font);
    font-weight: 600;
    font-size: clamp(1.7rem, 5vw, 2.2rem);
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .brand h1 span {
    display: block;
    margin-top: 4px;
    font-family: var(--sans);
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--mist);
  }
  .pill {
    border: 1px solid rgba(232,244,242,0.18);
    background: rgba(19,42,52,0.7);
    color: var(--foam);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }
  .tab {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    color: var(--mist);
    font: inherit;
    font-size: 0.85rem;
    padding: 8px 12px;
    border-radius: 999px;
    cursor: pointer;
  }
  .tab[aria-selected="true"] {
    color: var(--ink);
    background: var(--foam);
  }
  .status {
    min-height: 1.2em;
    margin: 0 0 10px;
    font-size: 0.8rem;
    color: var(--mist);
  }
  .status.error { color: #ffb4a8; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
    gap: 10px;
  }
  .card {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius);
    background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.18));
    border: 1px solid rgba(232,244,242,0.1);
    animation: rise 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .card:nth-child(2) { animation-delay: 40ms; }
  .card:nth-child(3) { animation-delay: 80ms; }
  .card:nth-child(4) { animation-delay: 120ms; }
  @keyframes rise {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to { opacity: 1; transform: none; }
  }
  .photo {
    aspect-ratio: 4 / 5;
    background: #16323c center/cover no-repeat;
    position: relative;
  }
  .photo::after {
    content: "";
    position: absolute;
    inset: auto 0 0 0;
    height: 45%;
    background: linear-gradient(transparent, rgba(7,20,26,0.85));
  }
  .photo-empty {
    display: grid;
    place-items: center;
    color: var(--mist);
    font-size: 0.75rem;
  }
  .body { padding: 10px 10px 12px; }
  .title {
    margin: 0 0 4px;
    font-family: var(--font);
    font-size: 0.95rem;
    line-height: 1.25;
    letter-spacing: -0.02em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .meta {
    margin: 0 0 8px;
    font-size: 0.72rem;
    color: var(--mist);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .price {
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }
  button.action {
    appearance: none;
    border: 0;
    border-radius: 999px;
    background: var(--tide);
    color: #04110e;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 650;
    padding: 7px 11px;
    cursor: pointer;
    transition: transform 120ms ease, background 120ms ease;
  }
  button.action:hover { background: #3aa892; }
  button.action:active { transform: scale(0.97); }
  button.action:disabled {
    opacity: 0.55;
    cursor: wait;
  }
  button.ghost {
    background: transparent;
    color: var(--foam);
    border: 1px solid rgba(232,244,242,0.25);
  }
  .empty {
    padding: 28px 12px;
    text-align: center;
    color: var(--mist);
    font-size: 0.9rem;
  }
  .cart-list { display: grid; gap: 10px; }
  .cart-line {
    display: grid;
    grid-template-columns: 64px 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 8px;
    border-radius: 12px;
    border: 1px solid rgba(232,244,242,0.1);
    background: rgba(19,42,52,0.55);
  }
  .cart-line img, .cart-thumb {
    width: 64px;
    height: 80px;
    object-fit: cover;
    border-radius: 8px;
    background: #16323c;
  }
  .dock {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: 10px;
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(11,28,36,0.92);
    border: 1px solid rgba(232,244,242,0.16);
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
  }
  .dock strong { font-variant-numeric: tabular-nums; }
  .checkout-urls { display: grid; gap: 8px; margin-top: 12px; }
  .checkout-urls a, .checkout-urls button.linkish {
    display: block;
    width: 100%;
    text-align: center;
    text-decoration: none;
    color: #04110e;
    background: var(--sand);
    border: 0;
    border-radius: 12px;
    padding: 12px;
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }
  .note {
    margin-top: 10px;
    font-size: 0.75rem;
    color: var(--mist);
    line-height: 1.4;
  }
</style>
</head>
<body>
  <header class="brand">
    <h1>Reswell<span>Shop surfboards in chat</span></h1>
    <div class="pill" id="cartPill">Cart · 0</div>
  </header>
  <div class="tabs" role="tablist">
    <button class="tab" id="tabBrowse" aria-selected="true" type="button">Boards</button>
    <button class="tab" id="tabCart" aria-selected="false" type="button">Cart</button>
  </div>
  <p class="status" id="status">Waiting for listings…</p>
  <section id="browsePane"></section>
  <section id="cartPane" hidden></section>
  <div class="dock" id="dock">
    <div><span id="dockCount">0 boards</span> · <strong id="dockTotal">$0</strong></div>
    <button class="action" id="dockCheckout" type="button">Checkout</button>
  </div>
<script>
(function () {
  const state = {
    view: "browse",
    query: "",
    listings: [],
    cart: { items: [], item_count: 0 },
    checkoutUrls: [],
    busy: false,
    hostReady: false,
  };

  const el = {
    status: document.getElementById("status"),
    browse: document.getElementById("browsePane"),
    cart: document.getElementById("cartPane"),
    cartPill: document.getElementById("cartPill"),
    tabBrowse: document.getElementById("tabBrowse"),
    tabCart: document.getElementById("tabCart"),
    dockCount: document.getElementById("dockCount"),
    dockTotal: document.getElementById("dockTotal"),
    dockCheckout: document.getElementById("dockCheckout"),
  };

  let nextId = 1;
  const pending = new Map();

  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "$—";
    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function setStatus(text, isError) {
    el.status.textContent = text || "";
    el.status.classList.toggle("error", !!isError);
  }

  function post(msg) {
    window.parent.postMessage(msg, "*");
  }

  function rpc(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      post({ jsonrpc: "2.0", id, method, params: params || {} });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error("timeout: " + method));
        }
      }, 20000);
    });
  }

  function notify(method, params) {
    post({ jsonrpc: "2.0", method, params: params || {} });
  }

  async function openLink(url) {
    if (!url) return;
    try {
      if (window.openai && typeof window.openai.openExternal === "function") {
        await window.openai.openExternal({ href: url });
        return;
      }
    } catch (_) {}
    try {
      await rpc("ui/open-link", { url });
      return;
    } catch (_) {}
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function callTool(name, args) {
    if (window.openai && typeof window.openai.callTool === "function") {
      const result = await window.openai.callTool(name, args || {});
      ingestToolResult(result);
      return result;
    }
    const result = await rpc("tools/call", { name, arguments: args || {} });
    ingestToolResult(result);
    return result;
  }

  function reportSize() {
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      320,
    );
    notify("ui/notifications/size-changed", { height });
  }

  function normalizeShopPayload(raw) {
    if (!raw || typeof raw !== "object") return null;
    const meta = raw._meta && (raw._meta["reswell/shop"] || raw._meta);
    const structured = raw.structuredContent || raw;
    const src = meta && meta.listings ? meta : structured;
    if (!src || typeof src !== "object") return null;
    return {
      view: src.view || (src.listings ? "browse" : src.items ? "cart" : "browse"),
      query: src.query || "",
      listings: Array.isArray(src.listings) ? src.listings : [],
      cart: src.cart || { items: src.items || [], item_count: src.item_count || 0 },
      checkout_urls: Array.isArray(src.checkout_urls)
        ? src.checkout_urls
        : src.checkout_url
          ? [src.checkout_url]
          : [],
      note: src.note || "",
      message: src.message || "",
    };
  }

  function ingestToolResult(result) {
    const payload = normalizeShopPayload(result);
    if (!payload) return;
    if (payload.listings.length) state.listings = payload.listings;
    if (payload.cart) state.cart = payload.cart;
    if (payload.query) state.query = payload.query;
    if (payload.checkout_urls.length) {
      state.checkoutUrls = payload.checkout_urls;
      state.view = "cart";
    } else if (payload.view) {
      state.view = payload.view;
    }
    if (payload.message) setStatus(payload.message, !!result.isError);
    render();
  }

  function cartCount() {
    const items = state.cart && state.cart.items ? state.cart.items : [];
    if (typeof state.cart.item_count === "number") return state.cart.item_count;
    return items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  }

  function cartTotal() {
    const items = state.cart && state.cart.items ? state.cart.items : [];
    return items.reduce(
      (sum, item) => sum + (Number(item.price_usd) || 0) * (Number(item.quantity) || 1),
      0,
    );
  }

  function renderBrowse() {
    if (!state.listings.length) {
      el.browse.innerHTML =
        '<div class="empty">Ask for boards — try “Channel Islands under $800” — and they will land here.</div>';
      return;
    }
    el.browse.innerHTML =
      '<div class="grid">' +
      state.listings
        .map((listing) => {
          const id = listing.id || listing.listing_id || "";
          const title = (listing.title || "Surfboard").replace(/</g, "&lt;");
          const dims = [listing.dimensions, listing.condition_label || listing.condition]
            .filter(Boolean)
            .join(" · ")
            .replace(/</g, "&lt;");
          const img = listing.image_url || "";
          const price = money(listing.price_usd);
          return (
            '<article class="card">' +
            (img
              ? '<div class="photo" style="background-image:url(\\'' +
                img.replace(/'/g, "%27") +
                '\\')"></div>'
              : '<div class="photo photo-empty">No photo</div>') +
            '<div class="body">' +
            '<p class="title">' +
            title +
            "</p>" +
            '<p class="meta">' +
            (dims || "Marketplace") +
            "</p>" +
            '<div class="row"><span class="price">' +
            price +
            '</span><button class="action" data-add="' +
            id +
            '" type="button">Add</button></div>' +
            "</div></article>"
          );
        })
        .join("") +
      "</div>";
  }

  function renderCart() {
    const items = state.cart && state.cart.items ? state.cart.items : [];
    if (!items.length && !state.checkoutUrls.length) {
      el.cart.innerHTML = '<div class="empty">Your cart is empty. Add a board from the picker.</div>';
      return;
    }
    let html = '<div class="cart-list">';
    html += items
      .map((item) => {
        const id = item.listing_id || item.id || "";
        const title = (item.title || "Board").replace(/</g, "&lt;");
        const seller = (item.seller_name || "Seller").replace(/</g, "&lt;");
        return (
          '<div class="cart-line">' +
          '<div class="cart-thumb"></div>' +
          '<div><p class="title">' +
          title +
          '</p><p class="meta">Qty ' +
          (item.quantity || 1) +
          " · " +
          seller +
          "</p></div>" +
          '<div class="row" style="flex-direction:column;align-items:flex-end;gap:6px">' +
          '<span class="price">' +
          money(item.price_usd) +
          '</span><button class="action ghost" data-remove="' +
          id +
          '" type="button">Remove</button></div></div>'
        );
      })
      .join("");
    html += "</div>";
    if (state.checkoutUrls.length) {
      html +=
        '<div class="checkout-urls">' +
        state.checkoutUrls
          .map(
            (url, i) =>
              '<button class="linkish" data-checkout="' +
              url.replace(/"/g, "&quot;") +
              '" type="button">Pay on Reswell' +
              (state.checkoutUrls.length > 1 ? " #" + (i + 1) : "") +
              "</button>",
          )
          .join("") +
        '</div><p class="note">Shipping and tax calculate on Reswell. The assistant cannot charge your card — hand these links through unchanged.</p>';
    }
    el.cart.innerHTML = html;
  }

  function render() {
    const count = cartCount();
    el.cartPill.textContent = "Cart · " + count;
    el.dockCount.textContent = count + (count === 1 ? " board" : " boards");
    el.dockTotal.textContent = money(cartTotal());
    const browse = state.view !== "cart";
    el.browse.hidden = !browse;
    el.cart.hidden = browse;
    el.tabBrowse.setAttribute("aria-selected", browse ? "true" : "false");
    el.tabCart.setAttribute("aria-selected", browse ? "false" : "true");
    if (browse) renderBrowse();
    else renderCart();
    reportSize();
  }

  async function withBusy(fn) {
    if (state.busy) return;
    state.busy = true;
    render();
    try {
      await fn();
    } catch (err) {
      setStatus(err && err.message ? err.message : "Something went wrong", true);
    } finally {
      state.busy = false;
      render();
    }
  }

  document.body.addEventListener("click", (event) => {
    const t = event.target;
    if (!(t instanceof HTMLElement)) return;
    const add = t.getAttribute("data-add");
    if (add) {
      withBusy(async () => {
        setStatus("Adding to cart…");
        await callTool("add_to_cart", { listing_ids: [add] });
        setStatus("Added. Want another board, or checkout?");
        state.view = "cart";
      });
      return;
    }
    const remove = t.getAttribute("data-remove");
    if (remove) {
      withBusy(async () => {
        setStatus("Updating cart…");
        await callTool("remove_from_cart", { listing_ids: [remove] });
        setStatus("Removed.");
      });
      return;
    }
    const checkout = t.getAttribute("data-checkout");
    if (checkout) {
      openLink(checkout);
    }
  });

  el.tabBrowse.addEventListener("click", () => {
    state.view = "browse";
    render();
  });
  el.tabCart.addEventListener("click", () => {
    state.view = "cart";
    withBusy(async () => {
      await callTool("get_cart", {});
    });
  });
  el.dockCheckout.addEventListener("click", () => {
    withBusy(async () => {
      setStatus("Preparing checkout — confirm in chat if asked…");
      await callTool("prepare_purchase", { buyer_confirmed: true });
      state.view = "cart";
      setStatus("Open a checkout link below. Nothing was charged here.");
    });
  });

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.jsonrpc !== "2.0") return;
    if (data.id != null && pending.has(data.id)) {
      const entry = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) entry.reject(new Error(data.error.message || "RPC error"));
      else entry.resolve(data.result);
      return;
    }
    if (data.method === "ui/notifications/tool-result") {
      ingestToolResult(data.params || {});
    }
    if (data.method === "ui/notifications/tool-input") {
      // no-op; results carry the payload
    }
  });

  async function boot() {
    try {
      await rpc("ui/initialize", {
        protocolVersion: "2026-01-26",
        appInfo: { name: "reswell-shop", version: "1.0.0" },
        appCapabilities: { availableDisplayModes: ["inline"] },
      });
      notify("ui/notifications/initialized", {});
      state.hostReady = true;
    } catch (_) {
      // Host may not speak MCP Apps handshake (e.g. ChatGPT skybridge).
    }

    if (window.openai && window.openai.toolOutput) {
      ingestToolResult({ structuredContent: window.openai.toolOutput });
    }

    render();
    setStatus(
      state.listings.length
        ? (state.query ? 'Showing “' + state.query + '”' : "Boards ready")
        : "Ask Reswell for boards to fill this picker.",
    );
  }

  boot();
})();
</script>
</body>
</html>`
}
