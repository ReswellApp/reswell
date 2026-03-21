# Stripe checkout (surfboards + shop cart)

## 1. API keys

1. Open [Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys).
2. Use **Test mode** while developing.
3. Copy the **Secret key** (`sk_test_…`).

In **`.env.local`** (never commit real keys):

```bash
STRIPE_SECRET_KEY=sk_test_xxxxxxxx
```

Restart `npm run dev` after changing env.

## 2. Supabase service role (recommended)

Marking shop orders **paid** and updating **inventory** uses the service role so RLS does not block updates.

In [Supabase → Settings → API](https://supabase.com/dashboard/project/_/settings/api), copy **service_role** into:

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Surfboard card checkout can work for some setups with only the anon key on the success callback; **shop cart confirmation** needs the service role for `/api/checkout/verify-cart-session`.

## 3. Webhooks (production + local)

### Production (e.g. Vercel)

1. [Stripe → Webhooks](https://dashboard.stripe.com/webhooks) → **Add endpoint**.
2. URL: `https://YOUR_DOMAIN/api/webhooks/stripe`
3. Event: **`checkout.session.completed`**
4. Copy the **Signing secret** (`whsec_…`) into:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

Redeploy after saving env vars.

### Local testing with Stripe CLI

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Use the CLI’s **webhook signing secret** as `STRIPE_WEBHOOK_SECRET` in `.env.local` while that process is running.

## 4. App URL

For correct Checkout return URLs, set:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

(On Vercel you can rely on `VERCEL_URL` if this is unset.)

## 5. Database: purchase shipping fields

Run in Supabase SQL editor (once):

`scripts/015_purchases_shipping_address.sql`

This adds `shipping_address` and `stripe_checkout_session_id` on `purchases` so surfboard card checkouts can store the buyer’s Stripe shipping form. Shop orders already use `orders.shipping_address`.

## 6. Test a payment

1. Use a [Stripe test card](https://docs.stripe.com/testing), e.g. `4242 4242 4242 4242`, any future expiry, any CVC.
2. Complete checkout; you should redirect back to `/boards/checkout/success` or `/shop/checkout/success`.
3. In Stripe Dashboard → **Payments**, confirm a succeeded payment.

## 7. Troubleshooting

| Symptom | Fix |
|--------|-----|
| “Add STRIPE_SECRET_KEY…” on checkout | Set secret key in `.env.local` and restart dev server. |
| Shop order stays pending | Add `SUPABASE_SERVICE_ROLE_KEY`, open success page (with `session_id` in URL), or configure webhook. |
| Webhook 400 invalid signature | `STRIPE_WEBHOOK_SECRET` must match the endpoint (CLI secret locally, Dashboard secret in prod). |
