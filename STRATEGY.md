# Reswell — Strategy Playbook

<!-- This file holds strategic decisions that guide campaign creation, keyword research,
     audience targeting, and budget allocation across all platforms. Skills and agents
     read this file before execution. Directives are guidance that informs research —
     not rigid rules that bypass validation. Only save directives the user has confirmed. -->

## Active Directives

### Cross-Platform Strategy
[No active directives yet — run a strategy analysis to populate after Adspirer is connected and user confirms candidates below]

### Google Ads
[No active directives]

### Meta Ads
[No active directives]

### LinkedIn Ads
[No active directives — no product integration; deprioritize unless B2B surf-shop acquisition is an explicit goal]

### TikTok Ads
[No active directives — no ads integration in codebase]

### Budget Allocation
[No active directives]

---

## Decision Log

### 2026-11-06 — $100k/mo GMS path audit (workspace bootstrap + sold-feed rebuild)
- **Context:** Cloud agent audit of Reswell path to $100k/month GMS. Adspirer MCP unavailable; used official sold-stats + full sold-feed pagination (395 sale lines).
- **Findings:**
  - Official lifetime GMS **$111,875** / 396 sales → blended AOV **$282.51**.
  - Current run-rate **~$27–29k/mo** (L30d $27.6k; Oct peak $29.4k). Gap to $100k ≈ **3.6×**.
  - Surfboard AOV **$484**; fins AOV **$68**. Boards drive ~91% of feed GMS.
  - Seller concentration: Hayden Garfield’s shop **65%** of feed GMS; only **48** unique sellers lifetime; **190+** live listings.
  - 7% take → **~$7k** platform fee at $100k GMS (before Stripe, waivers, tips).
- **Decisions:** None confirmed by user yet. Proposed candidates below for confirmation.

**Proposed directives (awaiting user confirmation):**
- `CONSTRAINT: Optimize to GMS (merchandise sales), not platform revenue alone — GMS is the headline north star for this growth phase.`
- `REQUIRE: Connect Adspirer (Google + Meta at minimum) and re-run performance review + audit_conversion_tracking before scaling spend.`
- `PREFER: Demand channels that buy intent for specific boards/models (Google Search / Shopping / PMax + Meta catalog) over pure awareness / giveaway traffic until monthly GMS baseline and CPA are known.`
- `PREFER: Grow surfboard GMS mix (AOV ~$484) over low-AOV gear volume when allocating paid demand.`
- `CONSTRAINT: Do not scale paid demand without a parallel inventory / seller-recruitment plan — ~190 live listings and 65% single-shop GMS concentration will cap sell-through.`
- `AVOID: Treating lifetime GMS or lifetime AOV as current monthly run-rate without refreshing sold-feed / admin MTD.`

---

## Archived Directives
[No archived directives]
