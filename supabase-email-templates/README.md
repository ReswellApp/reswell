# Supabase email templates

Configure **email verification after sign up** so users receive a professional confirmation email.

## 1. Enable confirm email

In **Supabase Dashboard** → **Authentication** → **Providers** → **Email**:

- Turn on **Confirm email** (e.g. “Enable email confirmations”).
- Save.

Until this is on, Supabase may not send confirmation emails for new signups.

## 2. Set redirect URL (optional)

In **Authentication** → **URL Configuration**:

- **Site URL:** your app URL (e.g. `https://your-app.vercel.app`).
- **Redirect URLs:** add `https://your-app.vercel.app/auth/confirm` (and your production domain) so the confirmation link can redirect back to your app.

## 3. Use the confirm-signup template

In **Authentication** → **Email Templates** → **Confirm signup**:

- **Subject:** paste the content of `confirm-signup-subject.txt`.
- **Message (HTML):** paste the **entire** content of `confirm-signup.html`.
- Save.

Variables such as `{{ .ConfirmationURL }}` and `{{ .Email }}` are replaced by Supabase when sending. Do not remove them.
