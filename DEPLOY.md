# Deploy to Vercel via GitHub

## 1. Push your code to GitHub

If the project isn’t on GitHub yet:

```bash
# Create a new repo on GitHub (github.com/new), then:
git remote add origin https://github.com/YOUR_USERNAME/surf-marketplace.git
git branch -M main
git push -u origin main
```

If it’s already a git repo, push as usual:

```bash
git add .
git commit -m "Prepare for Vercel deploy"
git push origin main
```

## 2. Import the project in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (use “Continue with GitHub” if you want).
2. Click **Add New…** → **Project**.
3. **Import** the `surf-marketplace` (or your repo name) from the list of GitHub repos.
4. Leave **Framework Preset** as **Next.js** (auto-detected).
5. **Root Directory**: leave as `.` unless the app lives in a subfolder.
6. **Build Command**: `next build` (default).
7. **Output Directory**: leave default.
8. Do **not** add env vars yet; click **Deploy** so the first build runs (it may fail without env vars; that’s expected).

## 3. Add environment variables

After the project is created:

1. Open the project in Vercel → **Settings** → **Environment Variables**.
2. Add these for **Production** (and **Preview** if you want):

| Name | Description | Example |
|------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (webhooks, admin) | `eyJhbGc...` |
| `STRIPE_SECRET_KEY` | Stripe secret key (payments) | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `NEXT_PUBLIC_APP_URL` | App URL (optional; Vercel sets this) | `https://your-app.vercel.app` |

- Get Supabase values: [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Settings** → **API**.
- Get Stripe values: [Stripe Dashboard](https://dashboard.stripe.com/apikeys) and **Developers** → **Webhooks**.

You can leave `NEXT_PUBLIC_APP_URL` blank; the app uses `VERCEL_URL` when set. For production, set it to your final domain (e.g. `https://surfmarketplace.com`) for correct redirects (e.g. checkout).

## 4. Redeploy

After saving env vars:

- **Deployments** → … on the latest deployment → **Redeploy** (with “Use existing Build Cache” unchecked if you want a clean build).

## 5. Stripe webhook (for payments)

So Stripe can confirm payments and run your logic:

1. [Stripe Dashboard](https://dashboard.stripe.com/webhooks) → **Add endpoint**.
2. **Endpoint URL**: `https://YOUR_VERCEL_DOMAIN/api/webhooks/stripe`.
3. **Events**: `checkout.session.completed`.
4. Copy the **Signing secret** and set it as `STRIPE_WEBHOOK_SECRET` in Vercel, then redeploy.

Local dev: see **`docs/STRIPE.md`** (`npm run stripe:listen` + test keys in `.env.local`).

## 6. (Optional) Custom domain

- **Settings** → **Domains** → add your domain and follow DNS instructions.

---

**Quick checklist**

- [ ] Code pushed to GitHub
- [ ] Project imported in Vercel from GitHub
- [ ] Env vars added in Vercel (at least Supabase URL + anon key)
- [ ] Redeploy after adding env vars
- [ ] Stripe webhook URL and `STRIPE_WEBHOOK_SECRET` set if using payments
