/**
 * Self-contained Reswell shop MCP App (board picker + cart).
 * Hosts render this HTML in a sandboxed iframe (Claude / ChatGPT / Goose).
 *
 * Visual language matches the marketplace: white canvas, #04070E ink,
 * #64748B muted text, #E2E8F0 borders, and the site wordmark.
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
    --ink: #04070E;
    --muted: #64748B;
    --line: #E2E8F0;
    --wash: #F8FAFC;
    --canvas: #FFFFFF;
    --danger: #b42318;
    --radius: 12px;
    --sans: "Avenir Next", "Segoe UI", system-ui, sans-serif;
    color-scheme: light;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    min-height: 100%;
    background: var(--canvas);
    color: var(--ink);
    font-family: var(--sans);
  }
  body { padding: 16px 16px 20px; }
  body.has-dock { padding-bottom: 76px; }
  .brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .brand-lockup { min-width: 0; }
  .logo {
    display: block;
    height: 26px;
    width: auto;
    max-width: 148px;
    object-fit: contain;
    object-position: left center;
  }
  .wordmark {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--ink);
  }
  .eyebrow {
    margin: 3px 0 0;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--line);
    background: var(--canvas);
    color: var(--ink);
    border-radius: 999px;
    padding: 6px 8px 6px 12px;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .pill:hover { background: var(--wash); }
  .count {
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--ink);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 650;
    display: inline-grid;
    place-items: center;
    font-variant-numeric: tabular-nums;
  }
  .tabs {
    display: flex;
    gap: 2px;
    margin: 0 0 12px;
    border-bottom: 1px solid var(--line);
  }
  .tab {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 550;
    padding: 8px 12px 10px;
    margin-bottom: -1px;
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }
  .tab[aria-selected="true"] {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }
  .status {
    min-height: 1.1em;
    margin: 0 0 12px;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .status:empty { display: none; }
  .status.error { color: var(--danger); }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 12px;
  }
  .card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--canvas);
    border: 1px solid var(--line);
    animation: rise 360ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .card:nth-child(2) { animation-delay: 40ms; }
  .card:nth-child(3) { animation-delay: 80ms; }
  .card:nth-child(4) { animation-delay: 120ms; }
  .card:hover {
    box-shadow: 0 10px 15px -3px rgb(4 7 14 / 0.08), 0 4px 6px -4px rgb(4 7 14 / 0.05);
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .card { animation: none; }
  }
  .photo {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    padding: 0;
    border: 0;
    background: var(--wash);
    color: var(--muted);
    font: inherit;
    font-size: 0.75rem;
    cursor: pointer;
    overflow: hidden;
  }
  .photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .photo-empty {
    display: grid;
    place-items: center;
    cursor: default;
  }
  .body { padding: 10px 10px 12px; display: flex; flex-direction: column; flex: 1; }
  .title {
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 650;
    line-height: 1.35;
    letter-spacing: 0;
    text-align: left;
    cursor: pointer;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card .title { min-height: 2.7em; }
  button.title:hover { text-decoration: underline; }
  .meta {
    margin: 4px 0 0;
    font-size: 0.75rem;
    line-height: 1.35;
    color: var(--muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card .meta { min-height: 2.7em; }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 8px;
  }
  .cart-actions {
    flex-direction: column;
    align-items: flex-end;
  }
  .price {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }
  .foot {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    margin-top: 8px;
    min-width: 0;
  }
  .place {
    margin: 0;
    max-width: 100%;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .chip {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 1px 7px;
    font-size: 0.65rem;
    line-height: 1.45;
    color: var(--muted);
  }
  button.action {
    appearance: none;
    border: 0;
    border-radius: 8px;
    background: var(--ink);
    color: #fff;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 550;
    padding: 7px 12px;
    cursor: pointer;
  }
  button.action:hover { background: #1c2433; }
  button.action:active { transform: scale(0.98); }
  button.action:disabled { opacity: 0.55; cursor: wait; }
  button.ghost {
    background: var(--canvas);
    color: var(--ink);
    border: 1px solid var(--line);
  }
  button.ghost:hover { background: var(--wash); }
  .empty {
    padding: 36px 12px;
    text-align: center;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .cart-list { display: grid; gap: 10px; }
  .cart-line {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--canvas);
  }
  .cart-line img, .cart-thumb {
    width: 56px;
    height: 72px;
    object-fit: cover;
    border-radius: 8px;
    background: var(--wash);
  }
  .dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(255,255,255,0.96);
    border-top: 1px solid var(--line);
    backdrop-filter: blur(8px);
  }
  .dock[hidden] { display: none; }
  .dock strong { font-variant-numeric: tabular-nums; }
  .checkout-urls { display: grid; gap: 8px; margin-top: 12px; }
  .checkout-urls button.linkish {
    display: block;
    width: 100%;
    text-align: center;
    text-decoration: none;
    color: #fff;
    background: var(--ink);
    border: 0;
    border-radius: 8px;
    padding: 12px;
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }
  .note {
    margin-top: 10px;
    font-size: 0.75rem;
    color: var(--muted);
    line-height: 1.4;
  }
</style>
</head>
<body>
  <header class="brand">
    <div class="brand-lockup">
      <img class="logo" id="logo" src="https://www.reswell.app/images/reswell-logo.png" alt="Reswell" width="996" height="137" />
      <p class="wordmark" id="wordmark" hidden>Reswell</p>
      <p class="eyebrow">Surfboards</p>
    </div>
    <button class="pill" id="cartPill" type="button">Cart <span class="count" id="cartCount">0</span></button>
  </header>
  <div class="tabs" id="tabs" role="tablist">
    <button class="tab" id="tabBrowse" aria-selected="true" type="button">Boards</button>
    <button class="tab" id="tabCart" aria-selected="false" type="button">Cart</button>
  </div>
  <p class="status" id="status"></p>
  <section id="browsePane"></section>
  <section id="cartPane" hidden></section>
  <div class="dock" id="dock" hidden>
    <div><span id="dockCount">0 boards</span><span id="dockSep"> · </span><strong id="dockTotal">$0</strong></div>
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
    shopping: true,
    busy: false,
    hostReady: false,
  };

  const el = {
    status: document.getElementById("status"),
    browse: document.getElementById("browsePane"),
    cart: document.getElementById("cartPane"),
    cartPill: document.getElementById("cartPill"),
    cartCount: document.getElementById("cartCount"),
    tabs: document.getElementById("tabs"),
    dock: document.getElementById("dock"),
    tabBrowse: document.getElementById("tabBrowse"),
    tabCart: document.getElementById("tabCart"),
    dockCount: document.getElementById("dockCount"),
    dockSep: document.getElementById("dockSep"),
    dockTotal: document.getElementById("dockTotal"),
    dockCheckout: document.getElementById("dockCheckout"),
    logo: document.getElementById("logo"),
    wordmark: document.getElementById("wordmark"),
  };

  if (el.logo) {
    el.logo.addEventListener("error", function () {
      el.logo.hidden = true;
      if (el.wordmark) el.wordmark.hidden = false;
    });
  }

  let nextId = 1;
  const pending = new Map();

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "$—";
    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function readableStatus(text) {
    const t = String(text || "").trim();
    if (!t) return "";
    const head = t.charAt(0);
    if (head === "{" || head === "[") return "";
    return t;
  }

  function setStatus(text, isError) {
    const next = readableStatus(text);
    el.status.textContent = next;
    el.status.classList.toggle("error", !!isError && !!next);
  }

  function inchMark(raw) {
    const t = String(raw || "").trim();
    if (!t) return "";
    if (/["″]$/.test(t) || /\\bin\\s*$/i.test(t)) return t;
    return t + "″";
  }

  function formatDimRecord(rec) {
    if (!rec || typeof rec !== "object") return "";
    const parts = [];
    const length = rec.L != null ? String(rec.L).trim() : "";
    const width = rec.W != null ? String(rec.W).trim() : "";
    const thick = rec.T != null ? String(rec.T).trim() : "";
    const volume = rec.V != null ? String(rec.V).trim() : "";
    if (length) parts.push(length);
    if (width) parts.push(inchMark(width));
    if (thick) parts.push(inchMark(thick));
    let line = parts.join(" × ");
    if (volume) {
      const vol = /l$/i.test(volume) ? volume.replace(/l$/i, " L") : volume + " L";
      line = line ? line + " · " + vol : vol;
    }
    return line;
  }

  function formatDimensions(raw) {
    if (raw == null) return "";
    if (typeof raw === "object") return formatDimRecord(raw);
    const t = String(raw).trim();
    if (!t || t === "[object Object]") return "";
    if (t.charAt(0) === "{") {
      try {
        return formatDimRecord(JSON.parse(t));
      } catch (_) {
        return "";
      }
    }
    return t;
  }

  function conditionLabel(listing) {
    const raw = listing.condition_label || listing.condition || "";
    const t = String(raw).trim();
    if (!t || t.charAt(0) === "{") return "";
    if (t.indexOf("_") >= 0) {
      return t.replace(/_/g, " ").replace(/\\b\\w/g, function (ch) { return ch.toUpperCase(); });
    }
    return t;
  }

  function placeName(city, state) {
    const rawCity = String(city || "").trim();
    const pretty = rawCity
      ? rawCity.toLowerCase().replace(/\\b\\w/g, function (ch) { return ch.toUpperCase(); })
      : "";
    const rawState = String(state || "").trim();
    const st = rawState.length === 2 ? rawState.toUpperCase() : rawState;
    return [pretty, st].filter(Boolean).join(", ");
  }

  function browseHeadline() {
    const n = state.listings.length;
    const q = state.query ? "“" + state.query + "”" : "";
    const noun = n === 1 ? "board" : "boards";
    if (!n) return q ? "No boards for " + q + "." : "Ask for a board to see it here.";
    return q ? n + " " + noun + " for " + q + "." : n + " " + noun + ".";
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
      280,
    );
    notify("ui/notifications/size-changed", { height });
  }

  function asObject(raw) {
    if (!raw) return null;
    if (typeof raw === "string") {
      const t = raw.trim();
      if (t.charAt(0) !== "{" && t.charAt(0) !== "[") return null;
      try {
        const parsed = JSON.parse(t);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (_) {
        return null;
      }
    }
    if (typeof raw === "object") return raw;
    return null;
  }

  function listingArray(src) {
    if (!src || typeof src !== "object") return [];
    if (Array.isArray(src.listings) && src.listings.length) return src.listings;
    if (Array.isArray(src.results) && src.results.length) {
      const sample = src.results.find(function (row) { return row && typeof row === "object"; });
      if (
        src.type === "listings" ||
        (sample && (sample.title || sample.image_url || sample.price_usd != null))
      ) {
        return src.results;
      }
    }
    return Array.isArray(src.listings) ? src.listings : [];
  }

  function normalizeShopPayload(raw) {
    const root = asObject(raw);
    if (!root) return null;
    const meta = root._meta && (root._meta["reswell/shop"] || root._meta);
    const structured = asObject(root.structuredContent) || root;
    const src = meta && (meta.listings || meta.results) ? meta : structured;
    if (!src || typeof src !== "object" || Array.isArray(src)) return null;
    const listings = listingArray(src);
    return {
      view: src.view || (listings.length ? "browse" : src.items ? "cart" : "browse"),
      query: src.query || "",
      listings: listings,
      cart: src.cart && typeof src.cart === "object"
        ? src.cart
        : Array.isArray(src.items) || typeof src.item_count === "number"
          ? { items: src.items || [], item_count: src.item_count || 0 }
          : null,
      checkout_urls: Array.isArray(src.checkout_urls)
        ? src.checkout_urls
        : src.checkout_url
          ? [src.checkout_url]
          : [],
      note: src.note || "",
      message: typeof src.message === "string" ? src.message : "",
      shopping: typeof src.shopping === "boolean" ? src.shopping : undefined,
    };
  }

  function applyStatus(payload, isError) {
    if (isError) {
      setStatus(readableStatus(payload && payload.message) || "Something went wrong", true);
      return;
    }
    if (payload && payload.checkout_urls && payload.checkout_urls.length) {
      setStatus("Checkout is ready. Nothing was charged here.", false);
      return;
    }
    if (state.view !== "cart") {
      setStatus(browseHeadline(), false);
      return;
    }
    const note = readableStatus(payload && payload.message);
    if (note) setStatus(note, false);
  }

  function ingestToolResult(result) {
    const payload = normalizeShopPayload(result);
    if (!payload) return;
    if (payload.listings.length) state.listings = payload.listings;
    if (payload.cart) state.cart = payload.cart;
    if (payload.view === "browse") state.query = payload.query || "";
    else if (payload.query) state.query = payload.query;
    if (typeof payload.shopping === "boolean") state.shopping = payload.shopping;
    if (payload.checkout_urls.length) {
      state.checkoutUrls = payload.checkout_urls;
      state.view = "cart";
    } else if (payload.view) {
      state.view = payload.view;
    }
    applyStatus(payload, !!result.isError);
    render();
  }

  function cartCount() {
    const items = state.cart && state.cart.items ? state.cart.items : [];
    if (typeof state.cart.item_count === "number") return state.cart.item_count;
    return items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  }

  function cartTotal() {
    const items = state.cart && state.cart.items ? state.cart.items : [];
    if (!items.length) return null;
    return items.reduce(
      (sum, item) => sum + (Number(item.price_usd) || 0) * (Number(item.quantity) || 1),
      0,
    );
  }

  function listingById(id) {
    for (let i = 0; i < state.listings.length; i++) {
      const listing = state.listings[i];
      if ((listing.id || listing.listing_id) === id) return listing;
    }
    return null;
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
        .map(function (listing) {
          const id = listing.id || listing.listing_id || "";
          const title = esc(listing.title || "Surfboard");
          const dims = esc(formatDimensions(listing.dimensions));
          const condition = esc(conditionLabel(listing));
          const place = esc(placeName(listing.city, listing.state));
          const img = listing.image_url ? String(listing.image_url) : "";
          const price = money(listing.price_usd);
          const htmlUrl = listing.urls && listing.urls.html ? String(listing.urls.html) : "";
          const openAttr = htmlUrl ? ' data-open="' + esc(htmlUrl) + '"' : "";
          const photo = img
            ? '<button class="photo" type="button"' + openAttr + '><img alt="" src="' + esc(img) + '"></button>'
            : '<div class="photo photo-empty">No photo</div>';
          const titleEl = htmlUrl
            ? '<button class="title" type="button"' + openAttr + ">" + title + "</button>"
            : '<p class="title">' + title + "</p>";
          const action =
            state.shopping === false
              ? htmlUrl
                ? '<button class="action" data-open="' + esc(htmlUrl) + '" type="button">View</button>'
                : ""
              : '<button class="action" data-add="' + esc(id) + '" type="button"' +
                (state.busy ? " disabled" : "") +
                ">Add</button>";
          const foot =
            place || condition
              ? '<div class="foot">' +
                (place ? '<p class="place">' + place + "</p>" : "") +
                (condition ? '<span class="chip">' + condition + "</span>" : "") +
                "</div>"
              : "";
          return (
            '<article class="card">' +
            photo +
            '<div class="body">' +
            titleEl +
            '<p class="meta">' + dims + "</p>" +
            '<div class="row"><span class="price">' +
            price +
            "</span>" +
            action +
            "</div>" +
            foot +
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
      .map(function (item) {
        const id = item.listing_id || item.id || "";
        const title = esc(item.title || "Board");
        const seller = esc(item.seller_name || "Seller");
        const known = listingById(id);
        const img = item.image_url || (known && known.image_url) || "";
        const thumb = img
          ? '<img alt="" src="' + esc(img) + '">'
          : '<div class="cart-thumb"></div>';
        return (
          '<div class="cart-line">' +
          thumb +
          '<div><p class="title">' +
          title +
          '</p><p class="meta">Qty ' +
          esc(item.quantity || 1) +
          " · " +
          seller +
          "</p></div>" +
          '<div class="row cart-actions">' +
          '<span class="price">' +
          money(item.price_usd) +
          '</span><button class="action ghost" data-remove="' +
          esc(id) +
          '" type="button">Remove</button></div></div>'
        );
      })
      .join("");
    html += "</div>";
    if (state.checkoutUrls.length) {
      html +=
        '<div class="checkout-urls">' +
        state.checkoutUrls
          .map(function (url, i) {
            return (
              '<button class="linkish" data-checkout="' +
              esc(url) +
              '" type="button">Pay on Reswell' +
              (state.checkoutUrls.length > 1 ? " #" + (i + 1) : "") +
              "</button>"
            );
          })
          .join("") +
        '</div><p class="note">Shipping and tax calculate on Reswell. The assistant cannot charge your card.</p>';
    }
    el.cart.innerHTML = html;
  }

  function render() {
    const shop = state.shopping !== false;
    if (!shop) state.view = "browse";
    el.cartPill.hidden = !shop;
    el.tabs.hidden = !shop;
    const count = cartCount();
    el.cartCount.textContent = String(count);
    el.dockCount.textContent = count + (count === 1 ? " board" : " boards");
    const total = cartTotal();
    el.dockSep.hidden = total == null;
    el.dockTotal.hidden = total == null;
    if (total != null) el.dockTotal.textContent = money(total);
    const showDock = shop && count > 0;
    el.dock.hidden = !showDock;
    document.body.classList.toggle("has-dock", showDock);
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

  document.body.addEventListener("click", function (event) {
    const t = event.target;
    if (!(t instanceof Element)) return;
    const host = t.closest("[data-open], [data-add], [data-remove], [data-checkout]");
    if (!host) return;
    const open = host.getAttribute("data-open");
    if (open && !host.hasAttribute("data-add")) {
      openLink(open);
      return;
    }
    const add = host.getAttribute("data-add");
    if (add) {
      withBusy(async function () {
        setStatus("Adding to cart…");
        await callTool("add_to_cart", { listing_ids: [add] });
        setStatus("Added. Want another board, or checkout?");
        state.view = "browse";
        render();
      });
      return;
    }
    const remove = host.getAttribute("data-remove");
    if (remove) {
      withBusy(async function () {
        setStatus("Updating cart…");
        await callTool("remove_from_cart", { listing_ids: [remove] });
        setStatus("Removed.");
      });
      return;
    }
    const checkout = host.getAttribute("data-checkout");
    if (checkout) openLink(checkout);
  });

  el.tabBrowse.addEventListener("click", function () {
    state.view = "browse";
    setStatus(browseHeadline(), false);
    render();
  });
  el.tabCart.addEventListener("click", function () {
    state.view = "cart";
    render();
    withBusy(async function () {
      await callTool("get_cart", {});
    });
  });
  el.cartPill.addEventListener("click", function () {
    state.view = "cart";
    render();
    withBusy(async function () {
      await callTool("get_cart", {});
    });
  });
  el.dockCheckout.addEventListener("click", function () {
    withBusy(async function () {
      setStatus("Preparing checkout…");
      await callTool("prepare_purchase", { buyer_confirmed: true });
      state.view = "cart";
      setStatus("Checkout is ready. Nothing was charged here.");
      render();
    });
  });

  window.addEventListener("message", function (event) {
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
  });

  window.addEventListener("openai:set_globals", function (event) {
    const globals = event && event.detail && event.detail.globals;
    const output = globals && globals.toolOutput != null
      ? globals.toolOutput
      : window.openai && window.openai.toolOutput;
    if (output) ingestToolResult({ structuredContent: output });
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
      return;
    }

    render();
    setStatus("Ask for a board to see it here.", false);
  }

  boot();
})();
</script>
</body>
</html>`
}
