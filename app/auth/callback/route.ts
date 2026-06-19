import { passwordResetLandingPath } from "@/lib/auth/password-reset-landing-flag";
import { isGoogleAuthUser } from "@/lib/auth/profile-completion";
import {
  GOOGLE_NEW_SIGNUP_COOKIE,
  isNewOAuthAccount,
  shouldShowGoogleSignUpWelcome,
} from "@/lib/auth/google-sign-up-welcome";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import {
  isTransientAuthNetworkError,
} from "@/lib/auth/clear-supabase-auth-cookies";
import {
  buildEmailSignUpSuccessPath,
  buildGoogleSignUpSuccessPath,
} from "@/lib/google-ads/sign-up-success-path";
import { trackKlaviyoNewAccountCreated } from "@/lib/klaviyo/track-new-account-created";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse, after } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

async function getUserAfterFailedCodeExchange(
  supabase: SupabaseClient,
): Promise<User | null> {
  const maxAttempts = 5

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (!error && user) return user
      if (
        error &&
        isTransientAuthNetworkError(error) &&
        attempt < maxAttempts - 1
      ) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)))
        continue
      }
    } catch (error) {
      if (
        isTransientAuthNetworkError(error) &&
        attempt < maxAttempts - 1
      ) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)))
        continue
      }
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1)))
    }
  }

  return null
}

async function exchangeCodeWithRetry(
  supabase: SupabaseClient,
  code: string,
): Promise<
  Awaited<ReturnType<SupabaseClient["auth"]["exchangeCodeForSession"]>>
> {
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    if (!result.error) return result;
    if (
      isTransientAuthNetworkError(result.error) &&
      attempt < maxAttempts - 1
    ) {
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      continue;
    }
    return result;
  }

  return supabase.auth.exchangeCodeForSession(code);
}

function copyAuthCookies(
  from: NextResponse,
  to: NextResponse,
): void {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set({
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      domain: cookie.domain,
      expires: cookie.expires,
      maxAge: cookie.maxAge,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      priority: cookie.priority,
      partitioned: cookie.partitioned,
    });
  });
}

function buildOAuthSuccessRedirect(
  origin: string,
  next: string,
  redirectResponse: NextResponse,
  user: User,
): NextResponse {
  let redirectPath = next;
  if (isGoogleAuthUser(user)) {
    redirectPath = buildGoogleSignUpSuccessPath(next);
    if (shouldShowGoogleSignUpWelcome(user)) {
      if (isNewOAuthAccount(user)) {
        after(async () => {
          try {
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
            console.error("[auth/callback] Klaviyo new-account (OAuth) failed:", e);
          }
        });
      }
    }
  }

  const finalResponse = NextResponse.redirect(`${origin}${redirectPath}`);
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

  // Handle PKCE flow (OAuth, etc.): session cookies must be set on this response.
  if (code) {
    const redirectResponse = NextResponse.redirect(`${origin}${next}`);
    const supabase = createRouteHandlerSupabaseClient(
      request,
      redirectResponse,
    );
    const { data, error } = await exchangeCodeWithRetry(supabase, code);
    const sessionUser = data.session?.user;
    if (!error && sessionUser) {
      return buildOAuthSuccessRedirect(
        origin,
        next,
        redirectResponse,
        sessionUser,
      );
    }

    // Code may already have been exchanged (double navigation / parallel tabs).
    // Retry briefly — cookies from the winning request can land after this exchange fails.
    const existingUser = await getUserAfterFailedCodeExchange(supabase);
    if (existingUser) {
      return buildOAuthSuccessRedirect(
        origin,
        next,
        redirectResponse,
        existingUser,
      );
    }
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

  return NextResponse.redirect(
    `${origin}/auth/error?error=${encodeURIComponent("Could not verify your account. Please try again.")}&redirect=${encodeURIComponent(next)}`,
  );
}
