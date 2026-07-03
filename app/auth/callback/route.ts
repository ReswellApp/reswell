import { accessTokenIndicatesPasswordRecovery } from "@/lib/auth/access-token-password-recovery";
import {
  parseMarketingOptInParam,
  userMarketingOptInFromMetadata,
} from "@/lib/auth/marketing-email-consent";
import { passwordResetLandingPath } from "@/lib/auth/password-reset-landing-flag";
import { exchangeAuthCodeWithRetry } from "@/lib/auth/exchange-auth-code-with-retry";
import { isGoogleAuthUser } from "@/lib/auth/profile-completion";
import {
  GOOGLE_NEW_SIGNUP_COOKIE,
  isNewOAuthAccount,
  shouldShowGoogleSignUpWelcome,
} from "@/lib/auth/google-sign-up-welcome";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { buildAuthCompletingPath, buildAuthCompletingUrl } from "@/lib/auth/build-auth-completing-url";
import { copySupabaseAuthCookies } from "@/lib/auth/copy-supabase-auth-cookies";
import { isRecoverableOAuthCodeExchangeError } from "@/lib/auth/is-recoverable-oauth-code-exchange-error";
import { waitForUserAfterOAuthExchange } from "@/lib/auth/wait-for-user-after-oauth-exchange";
import {
  buildEmailSignUpSuccessPath,
  buildGoogleSignUpSuccessPath,
} from "@/lib/google-ads/sign-up-success-path";
import { trackKlaviyoNewAccountCreated } from "@/lib/klaviyo/track-new-account-created";
import { applyMarketingEmailConsent } from "@/lib/services/marketingEmailConsent";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse, after } from "next/server";
import type { User } from "@supabase/supabase-js";

function copyAuthCookies(
  from: NextResponse,
  to: NextResponse,
): void {
  copySupabaseAuthCookies(from, to);
}

async function applyOAuthMarketingConsent(
  user: User,
  marketingFromCallback: boolean | null,
): Promise<void> {
  const explicitOptIn =
    marketingFromCallback ?? userMarketingOptInFromMetadata(user);
  if (explicitOptIn === null) return;

  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (!hasServiceRole) {
    console.warn("[auth/callback] marketing consent skipped: no service role key");
    return;
  }

  try {
    await applyMarketingEmailConsent({
      userId: user.id,
      email: user.email ?? null,
      optIn: explicitOptIn,
      supabase: createServiceRoleClient(),
    });
  } catch (e) {
    console.error("[auth/callback] marketing consent failed:", e);
  }
}

function buildOAuthSuccessRedirect(
  origin: string,
  next: string,
  redirectResponse: NextResponse,
  user: User,
  marketingFromCallback: boolean | null,
): NextResponse {
  let redirectPath = next;
  if (isGoogleAuthUser(user)) {
    redirectPath = buildGoogleSignUpSuccessPath(next);
  }

  if (isNewOAuthAccount(user)) {
    after(async () => {
      try {
        await applyOAuthMarketingConsent(user, marketingFromCallback);
        if (!isGoogleAuthUser(user) || !shouldShowGoogleSignUpWelcome(user)) {
          return;
        }
        const hasServiceRole = Boolean(
          process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
        );
        if (hasServiceRole) {
          await trackKlaviyoNewAccountCreated(user, {
            supabaseForProfile: createServiceRoleClient(),
          });
        } else {
          await trackKlaviyoNewAccountCreated(user);
        }
      } catch (e) {
        console.error("[auth/callback] OAuth post-signup failed:", e);
      }
    });
  }

  const finalResponse = NextResponse.redirect(
    `${origin}${buildAuthCompletingPath(redirectPath)}`,
  );
  if (isGoogleAuthUser(user) && shouldShowGoogleSignUpWelcome(user)) {
    finalResponse.cookies.set(GOOGLE_NEW_SIGNUP_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
  }
  copyAuthCookies(redirectResponse, finalResponse);
  finalResponse.headers.set("Cache-Control", "private, no-store");
  return finalResponse;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeRedirectPath(searchParams.get("next"));
  const marketingFromCallback = parseMarketingOptInParam(
    searchParams.get("marketing"),
  );

  // Handle PKCE flow (OAuth, etc.): session cookies must be set on this response.
  if (code) {
    const redirectResponse = NextResponse.redirect(`${origin}${next}`);
    const supabase = createRouteHandlerSupabaseClient(
      request,
      redirectResponse,
    );
    const { data, error } = await exchangeAuthCodeWithRetry(supabase, code);
    const sessionUser = data.session?.user;
    if (!error && sessionUser) {
      const destination = accessTokenIndicatesPasswordRecovery(
        data.session?.access_token,
      )
        ? passwordResetLandingPath()
        : next;
      return buildOAuthSuccessRedirect(
        origin,
        destination,
        redirectResponse,
        sessionUser,
        marketingFromCallback,
      );
    }

    // Code may already have been exchanged (double navigation / parallel tabs).
    // Poll longer on mobile — cookies from the winning request can land after this fails.
    const pollAttempts =
      error && isRecoverableOAuthCodeExchangeError(error) ? 32 : 24;
    const existingUser = await waitForUserAfterOAuthExchange(supabase, {
      maxAttempts: pollAttempts,
      baseDelayMs: 100,
    });
    if (existingUser) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const destination = accessTokenIndicatesPasswordRecovery(
        session?.access_token,
      )
        ? passwordResetLandingPath()
        : next
      return buildOAuthSuccessRedirect(
        origin,
        destination,
        redirectResponse,
        existingUser,
        marketingFromCallback,
      );
    }

    return NextResponse.redirect(buildAuthCompletingUrl(origin, next));
  }

  // Handle email OTP / magic link flow (token_hash). Recovery emails must land on
  // `/auth/update-password` so users can call `updateUser({ password })` with cookies set.
  if (token_hash && type) {
    const otpNext =
      type === "recovery"
        ? passwordResetLandingPath()
        : safeRedirectPath(searchParams.get("next"));
    const redirectResponse = NextResponse.redirect(`${origin}${otpNext}`);
    const supabase = createRouteHandlerSupabaseClient(
      request,
      redirectResponse,
    );
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email" | "signup" | "recovery" | "invite",
    });
    if (!error) {
      const u = data.user ?? data.session?.user;
      if (type === "signup" && u) {
        const redirectPath = buildEmailSignUpSuccessPath(otpNext);
        redirectResponse.headers.set("Location", `${origin}${redirectPath}`);
        after(async () => {
          try {
            const hasServiceRole = Boolean(
              process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
            );
            if (hasServiceRole) {
              await trackKlaviyoNewAccountCreated(u, {
                supabaseForProfile: createServiceRoleClient(),
              });
            } else {
              await trackKlaviyoNewAccountCreated(u);
            }
          } catch (e) {
            console.error("[auth/callback] Klaviyo new-account (OTP signup) failed:", e);
          }
        });
      }
      redirectResponse.headers.set("Cache-Control", "private, no-store");
      return redirectResponse;
    }
  }

  return NextResponse.redirect(buildAuthCompletingUrl(origin, next));
}
