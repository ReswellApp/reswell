# Elasticsearch search

The **nav search bar** (magnifying glass) is the main site-wide search. It navigates to **`/search`**, a dedicated results page that searches across **used gear** and **surfboards**. When `ELASTICSEARCH_URL` is set, `/search` uses Elasticsearch for relevance-ranked results; otherwise it falls back to Supabase `ilike` queries.

## Quick setup (Vercel + Elastic Cloud)

1. **Elastic Cloud** — Create a deployment at [cloud.elastic.co](https://cloud.elastic.co). Copy the deployment URL and create an API key (Deployment → API keys → Create API key; use the base64 value).

2. **Vercel** — Project → **Settings** → **Environment Variables**. Add:

| Name | Value |
|------|--------|
| `ELASTICSEARCH_URL` | e.g. `https://my-deployment.es.us-central1.gcp.elastic.cloud:443` |
| `ELASTICSEARCH_API_KEY` | Your Elastic Cloud API key (base64 string) |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for reindex (reads all listings) |

3. **Redeploy** so env vars load.

4. **Reindex** — Go to **Admin** → **Settings** and click **Reindex search**. No curl or secrets needed.

**Security:** Never commit API keys to git. Use Vercel env vars only.

## Environment variables

See `.env.example`. Minimum:

- `ELASTICSEARCH_URL` — cluster URL (e.g. Elastic Cloud deployment URL)
- `ELASTICSEARCH_API_KEY` — API key (Elastic Cloud), **or** `ELASTICSEARCH_USERNAME` + `ELASTICSEARCH_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY` — required for reindex (reads all listings)

Optional:

- `ELASTICSEARCH_LISTINGS_INDEX` — defaults to `reswell_listings`
- `SEARCH_REINDEX_SECRET` — Bearer token for `POST /api/search/reindex` (for CI/scripts; not needed if you use the admin UI)
- `SUPABASE_ES_WEBHOOK_SECRET` — protects `POST /api/search/es-webhook`

## Reindex (admin UI)

The easiest way to reindex: log in as admin, go to **Admin** → **Settings**, and click **Reindex search**. The index is built from all active `used` and `surfboards` listings.

## Reindex via API (optional)

For CI or scripts, you can call the API with a Bearer token:

```bash
curl -X POST https://YOUR_DOMAIN/api/search/reindex \
  -H "Authorization: Bearer YOUR_SEARCH_REINDEX_SECRET"
```

Set `SEARCH_REINDEX_SECRET` in Vercel to match. Or use a logged-in admin session (cookies); the route accepts either.

## Keeping the index fresh

1. **Supabase Database Webhook** (recommended): create a webhook on `public.listings` for INSERT, UPDATE, DELETE pointing to `https://YOUR_DOMAIN/api/search/es-webhook` with header `Authorization: Bearer YOUR_SUPABASE_ES_WEBHOOK_SECRET` (or `X-ES-Webhook-Secret`).

2. **API creates**: `POST /api/listings` triggers a best-effort sync after insert.

3. **Sell flow / dashboard updates**: if listings are updated only from the browser, rely on the webhook or run reindex periodically.

## Relevance

Queries no longer use a single loose `OR` across every token. **Pure-number tokens** (e.g. `6`, `4`, `3` from thickness `6/4/3`) are ignored for the *required* match set so one digit cannot match unrelated titles like “Monsta **6**”. Search requires a **majority of meaningful terms** (letters/alphanumerics ≥2 chars) to match across title, description, category, brand, etc., with **phrase boosts** so close title matches rank higher. Digit-only queries stay lenient. The Supabase fallback uses the same **meaningful-term** idea (AND across terms). **No reindex** is required for these query changes.

## Local Elastic (Docker)

```bash
docker run -d --name es -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0
```

Set `ELASTICSEARCH_URL=http://localhost:9200` (no API key).
