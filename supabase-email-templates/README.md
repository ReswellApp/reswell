# Supabase email templates

Configure **email verification after sign up** so users receive a professional confirmation email.

## 1. Enable confirm email

In **Supabase Dashboard** → **Authentication** → **Providers** → **Email**:

- Turn on **Confirm email** (e.g. “Enable email confirmations”).
- Save.

Until this is on, Supabase may not send confirmation emails for new signups.

## 2. Set redirect URLs

In **Authentication** → **URL Configuration**:

- **Site URL:** your app URL (e.g. `https://www.reswell.app` in production, `http://localhost:3000` locally).
- **Redirect URLs:** add every origin you use. Missing entries cause Supabase to fall back to Site URL and break login / password reset.

Required paths (per origin):

- `https://www.reswell.app/auth/callback` — Google OAuth and PKCE sign-in
- `https://www.reswell.app/auth/recovery` — password reset emails (`redirect_to`)
- `https://www.reswell.app/auth/confirm` — email confirmation after sign-up
- Local dev: same paths with `http://localhost:3000` (and `http://127.0.0.1:3000` if you use it)

Password reset lands on `/auth/recovery`, then `/auth/update-password` to choose a new password.

## 3. Use the confirm-signup template

In **Authentication** → **Email Templates** → **Confirm signup**:

- **Subject:** paste the content of `confirm-signup-subject.txt`.
- **Message (HTML):** paste the **entire** content of `confirm-signup.html`.
- Save.

The template links to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` so the app’s server route can call `verifyOtp` and set session cookies. Do **not** use `{{ .ConfirmationURL }}` alone — it skips `/auth/confirm` and breaks sign-up confirmation in this app.

Also keep `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`, and `{{ .Data.display_name }}` placeholders intact.

## 4. Use the reset-password template

In **Authentication** → **Email Templates** → **Reset password**:

- **Subject:** paste the content of `reset-password-subject.txt`.
- **Message (HTML):** paste the **entire** content of `reset-password.html`.
- Save.

The template links to `{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&type=recovery` so the app’s server route can call `verifyOtp` and open the set-new-password dialog. Do **not** use `{{ .ConfirmationURL }}` alone — it skips `/auth/recovery` and breaks password reset in this app.

Also keep `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`, and `{{ .Data.display_name }}` placeholders intact.

## 5. Send from Reswell (not “Supabase Auth”)

The **HTML template** controls the logo and layout **inside** the email. The **From** line (`Supabase Auth <noreply@mail.app.supabase.io>`) is controlled separately — Supabase’s built-in mailer always uses that sender until you configure **Custom SMTP**.

### Steps

1. **Pick a transactional provider** on your domain (common: [Resend](https://resend.com), Postmark, SendGrid, AWS SES).
2. **Verify `reswell.app`** in that provider and add DNS records (SPF + DKIM; DMARC recommended).
3. In **Supabase Dashboard** → **Project Settings** → **Authentication** → **SMTP Settings**:
   - Enable **Custom SMTP**
   - **Sender email:** e.g. `noreply@reswell.app` (must be allowed by your provider)
   - **Sender name:** `Reswell`
   - Host / port / username / password: from your provider’s SMTP docs
4. Save and send a test reset email.

Example (Resend SMTP): host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key (`RESEND_API_KEY` in `.env.local`), from `noreply@reswell.app`, sender name `Reswell`.

| Supabase SMTP field | Value |
| --- | --- |
| Enable custom SMTP | On |
| Sender email | `noreply@reswell.app` |
| Sender name | `Reswell` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your `RESEND_API_KEY` (`re_…`) |

Store the key in `.env.local` as `RESEND_API_KEY` for your records, then paste it into Supabase SMTP **Password** (Supabase does not read Vercel/Next env vars for mail).

After this, inbox shows **Reswell** as the sender while still using the same `reset-password.html` body. Klaviyo is separate — it does not replace Supabase auth emails.

**Gmail avatar** next to the sender name is optional (BIMI + verified logo + DMARC); most teams start with custom SMTP + sender name only.
