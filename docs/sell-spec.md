# Reswell `/sell` Redesign — Cursor Working Spec

> **How to use this file:** save it as `docs/sell-spec.md` in the repo. Paste **§0 Kickoff** into Cursor chat as your first message and `@`-mention this file. Every later task starts by re-mentioning this file so the locked decisions stay in context.

---

## §0 Kickoff (paste this into Cursor)

You are working on Reswell, a peer-to-peer surf marketplace (Next.js App Router). We are rebuilding the `/sell` listing flow. Read `docs/sell-spec.md` in full before writing any code.

Before you start:

1. Map the current implementation. Report back with the actual file paths for: the `/sell` hub, `/sell/quick`, `/sell/boards` (all wizard steps), the other category routes, the catalog search component, the draft persistence layer (both IndexedDB and server), and the auth modal/wall. Do not guess — read the files.
2. Tell me where my spec conflicts with what's actually in the codebase. I wrote it from a product doc, not from the source. If I've assumed a component or table that doesn't exist, say so before building around it.
3. Then propose a task breakdown for **Phase 0 only**. Do not touch Phase 1+.

Work one task at a time. Show me the plan for each task before you write code. Don't create parallel "v2" components that leave the old ones orphaned — modify in place or delete what you replace.

---

## §1 Context

`/sell` is our biggest product weakness. Two personas:

- **New seller** — lists one board occasionally. Wants photos → price → publish in under a minute. Often unsigned until publish. Abandons if work is lost or the path feels like busywork.
- **Power seller** — lists often, manages drafts, needs shipping, resume, keyboard speed. Needs reliability over hand-holding.

Current architecture forks surfboards into `/sell/quick` (fast, pickup-only, IndexedDB drafts) and `/sell/boards` (multi-step wizard, shipping, server drafts). Other categories have their own routes with inconsistent patterns.

---

## §2 Locked product decisions

These are decided. Don't relitigate them in code review comments; if you think one is wrong, raise it in chat first.

1. **One board form, not two.** Quick vs Full is a fork the seller has to guess at before entering any data, and guessing wrong costs a restart. Shipping and detail are *extensions* of a listing, not a different way to list.
2. **Progressive disclosure by folding, not hiding.** Every section (Delivery, Board details, Description) is always visible on the page as a collapsed header with completion state. Nothing lives behind a "show advanced" link. A power seller must never have to hunt for shipping.
3. **Every listing-in-progress gets a URL and a server row** from the first meaningful input — guest or signed-in. This one primitive collapses resume, back, refresh, auth-claim, and multi-draft into a single mechanism.
4. **Auth is a modal, never a navigation.** It appears at photo upload and at publish. State is preserved across it, always.
5. **Never auto-route and never auto-resume.** Catalog match requires explicit confirmation. Drafts are offered, not restored.
6. **Quality is recovered post-publish**, not enforced pre-publish. A live listing with a completeness nudge converts better than a required field that caused an abandon.

---

## §3 Data model

### Phase 0 decision (locked)

**Guest + signed-in drafts reuse `listings` rows with `status = 'draft'`.** Extend the existing draft API with a guest-token httpOnly cookie (set lazily on first draft write). Do **not** create a separate `listing_drafts` table in Phase 0. Phase 1 may still introduce draft-URL primitives on top of this.

Claim rule still applies: on sign-in, guest draft rows are **claimed onto the user as separate drafts**, never silently merged into an existing account draft.

### Phase 1+ target (context only)

Create a single `listing_drafts` table (adapt names to existing conventions) *if* we later split drafts from `listings`:

```
id              uuid, appears in the URL
owner_user_id   nullable
guest_token     nullable, httpOnly cookie, set lazily on first draft write
category        'board' | 'wetsuit' | 'fin' | 'magazine' | ...
catalog_item_id nullable, set only on explicit user confirmation
fields          jsonb, per-category schema
status          'draft' | 'publishing' | 'published' | 'archived'
created_at, updated_at
```

Rules:

- Row is created on **first meaningful input**, not on page load. Page load must not create drafts or we'll spam every bounce.
- Autosave debounced (~800ms) and on blur. Field-level last-write-wins keyed on `updated_at` so two tabs degrade gracefully instead of clobbering.
- On sign-in, guest drafts are **claimed, never merged**. If the user already has drafts, the guest draft is attached as a *separate* draft and they choose. Silent merging is how we lose work, and losing work is the one thing this flow cannot survive.

---

## §4 Routes (target state)

```
/sell                      hub / command center
/sell?new=1                type picker sheet rendered over the hub
/sell/board/[draftId]      one board form
/sell/[category]/[draftId] same engine, per-category field schema
```

**Hub order — drafts first.** `/sell` is not a search wall:

1. **Continue** — up to 3 unfinished drafts, "see all"
2. **What are you selling?** — single search input
3. **Your live listings** — inline actions (mark sold, drop price)
4. Browse by type grid

**Search results** are one list containing catalog matches *and* a permanent, first-class "List a surfboard manually" row — not a footer, not a fallback shown only on zero results. Where catalog coverage is thin, that row is the difference between a bounce and a listing. Enter never selects a result.

**Catalog confirmation is a block at the top of the form**, not its own screen — a card showing the matched item with a "Not this? Change" link. Selection stays explicit without spending a navigation on a screen whose only possible action is "yes."

---

## §5 Required vs optional for a first publish

**Required (surfboards) — six fields, no more:**

- Category (implied by route)
- One photo
- Price
- Condition (3–4 options, not 6)
- Location — coarse, city/region, from IP or one tap of geolocation. **No map pin.**
- Length — the one board-specific exception. Every surfer knows it without measuring, it's usually written on the board, and a board without a length is nearly unsearchable.

**Explicitly NOT required:**

- **Title** — generate from catalog match, or from type + length + condition. Never block on a text field the user has no opinion about.
- **Shipping** — default pickup-only. Never a publish blocker.
- **Map confirmation** — exact meetup location is a messages problem. Precise location only becomes relevant if the seller later adds local delivery.
- **Description** — offer a generated starter from the catalog and structured fields.
- Volume, width, thickness, fin setup, construction, tail, year.

**Publish button is never a dead disabled control.** Sticky bar that names what's missing: "Add a price to publish."

**Post-publish completeness meter** — one-tap prompts for +volume, +photos, +shipping, framed as reach, not chores: "Boards with volume listed show up in 40% more searches." (Confirm that stat against real data before shipping the copy.)

**Celebration screen** offers three actions: *List another*, *List another like this* (duplicates everything except photos and serial — big for someone offloading a quiver), and the completeness nudges.

---

## §6 Back and "Create listing" behavior

- Browser back must equal in-app back. The draft URL gives this for free; forward reopens the same draft intact.
- **No back inside the form.** One screen, sections fold.
- **Delete the path-picker as a back destination.** Sending someone backward into a re-decision screen is a funnel restart and it's the sharpest edge in the current design.
- `Create listing` CTA:
  - no drafts → `/sell?new=1`, type picker opens immediately
  - has drafts → `/sell`, hub leads with `Continue: 5'10" Puddle Jumper`, secondary `Start something new`
  - one draft, minutes old, same session → hub renders that draft card focused with Continue as primary — **still a click**

---

## §7 Phase 0 — build this now (no consolidation)

Goal: make the existing fork *recoverable* and get the instrumentation that scopes Phase 1.

**0.1 — "Add shipping & details" inside Quick.** Carries all state forward into Full with zero re-entry. This is the highest-leverage cheap fix: a wrong guess at the fork costs one click instead of a restart. Instrument the click rate — that number tells us how to scope the merge.

**0.2 — Move Quick drafts to the server**, keyed to a guest-token cookie. Parity with Full. Keep IndexedDB as an offline write-through cache if it's already load-bearing, but the server row is the source of truth.

**0.3 — Reorder the hub** to drafts-first per §4.

**0.4 — Remove the path-picker as a back destination.** Back from Quick goes to wherever the user actually came from.

**0.5 — Fix the mobile pre-auth photo drop.** Let users *select* photos while unsigned and upload after auth. Right now the sign-in wall eats the selection and they don't come back. Probably our largest single mobile drop-off.

**0.6 — Instrumentation.** Funnel by entry point (header CTA, bare `/sell`, catalog handoff, celebration "list another"); per-field drop-off; and **fork regret** — sellers who start in Quick and restart in Full. Ship this first if anything is going to slip; the rest of the roadmap depends on reading it.

> **Status (Phase 0):** P0.1–P0.6 implemented in-repo. Apply migrations `20270807160000_sell_funnel_entry_point.sql` (funnel) and `20270807170000_listings_guest_draft_token.sql` (guest drafts + draft SELECT lockdown) before relying on dashboard aggregates or guest server drafts.

### Phase 0 acceptance criteria

- A guest can fill Quick, close the tab, reopen `/sell` on the same device, and see their draft under Continue.
- A guest who signs in at publish loses nothing, and any pre-existing drafts on that account are still there as separate drafts.
- Clicking "Add shipping & details" from Quick lands in Full with every field already populated and zero fields to re-enter.
- Back from any form step never lands on a chooser screen.
- On mobile, selecting photos while unsigned then signing in preserves the selection.
- Every event in 0.6 is firing and visible in the dashboard.

---

## §8 Later phases — context only, do not build yet

**Phase 1 — consolidate boards.** One form at `/sell/board/[id]`. Draft-URL primitive. Post-publish completeness. `/sell/boards` becomes a redirect with `?expand=all`. **Roll to new users first** — that's where the conversion signal is — and keep `/sell/boards` alive for power sellers until expand-all and shipping profiles land. Don't migrate our best sellers into a form missing their defaults.

**Phase 2 — power depth.** Sticky expand-all preference, keyboard flow, saved shipping profiles ("all my boards ship from Ventura, $85 flat"), duplicate-listing, real drafts view with archive, photo-first bulk entry (dump 12 photos → 4 grouped drafts).

**Phase 3 — one engine, many categories.** Every category renders from the same form component with a per-category field schema. This is the actual fix for category drift: chooser, catalog search, and live routes all read from one config, so they can't diverge again.

---

## §9 Risks to design against

- **Shipping quality.** Optional shipping means most listings go pickup-only, thinning liquidity outside dense markets. Mitigate with saved shipping profiles, the post-publish reach nudge, and surfacing "a buyer asked about shipping" back to the seller.
- **SEO / catalog accuracy.** Auto-titles plus optional fields produce thin, near-duplicate pages. `noindex` until a completeness threshold clears, then index. **Never** write manually-entered board data back into the canonical catalog without moderation — an unconfirmed match polluting a model-level page is worse than no match.
- **Draft collisions.** Two tabs, or a guest draft meeting an existing account draft. Draft ID in the URL is authoritative; field-level last-write-wins; never auto-merge on claim.
- **Mobile.** Likely 70%+ of listings. Photo capture is the first interaction, not a field partway down. Sticky publish bar that names what's missing.
- **Change risk on consolidation.** Power sellers will feel the new form as a downgrade before they feel it as an upgrade. Ship shipping profiles and expand-all *with* the migration, not after.

---

## §10 Guardrails for the agent

- Read before writing. Report conflicts between this spec and the codebase rather than coding around them.
- Follow existing Reswell patterns for data access, auth, and styling. Match the conventions you find; don't introduce a new state library or form library.
- Server Components by default; client boundaries only where interactivity requires them.
- No new dependencies without asking.
- Every task ships with the analytics events it needs.
- Never delete or migrate draft data without an explicit migration plan reviewed in chat first.
- Prefer deleting the old path over leaving both. Dead code here is how we got two apps.
