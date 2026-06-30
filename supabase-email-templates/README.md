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

Password reset lands on `/auth/recovery`, then `/?password_reset=1` opens the set-new-password dialog.

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
