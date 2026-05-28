import { passwordResetLandingPath } from "@/lib/auth/password-reset-landing-flag";
import { isGoogleAuthUser } from "@/lib/auth/profile-completion";
import {
  GOOGLE_NEW_SIGNUP_COOKIE,
  isNewOAuthAccount,
  shouldShowGoogleSignUpWelcome,
} from "@/lib/auth/google-sign-up-welcome";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import {
  buildEmailSignUpSuccessPath,
  buildGoogleSignUpSuccessPath,
} from "@/lib/google-ads/sign-up-success-path";
import { trackKlaviyoNewAccountCreated } from "@/lib/klaviyo/track-new-account-created";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse, after } from "next/server";

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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const u = data.session?.user;
      let redirectPath = next;
      if (u && isGoogleAuthUser(u)) {
        redirectPath = buildGoogleSignUpSuccessPath(next);
        if (shouldShowGoogleSignUpWelcome(u)) {
          if (isNewOAuthAccount(u)) {
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
                console.error("[auth/callback] Klaviyo new-account (OAuth) failed:", e);
              }
            });
          }
        }
      }
      const finalResponse = NextResponse.redirect(`${origin}${redirectPath}`);
      if (u && isGoogleAuthUser(u) && shouldShowGoogleSignUpWelcome(u)) {
        finalResponse.cookies.set(GOOGLE_NEW_SIGNUP_COOKIE, "1", {
          path: "/",
          maxAge: 60 * 30,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
        });
      }
      redirectResponse.cookies.getAll().forEach((cookie) => {
        finalResponse.cookies.set({
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
      finalResponse.headers.set("Cache-Control", "private, no-store");
      return finalResponse;
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
    `${origin}/auth/error?error=Could+not+verify+your+account.+Please+try+again.`,
  );
}
