import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";
import { type NextRequest, NextResponse } from "next/server";

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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirectResponse.headers.set("Cache-Control", "private, no-store");
      return redirectResponse;
    }
  }

  // Handle email OTP / magic link flow (token_hash)
  if (token_hash && type) {
    const redirectResponse = NextResponse.redirect(`${origin}${next}`);
    const supabase = createRouteHandlerSupabaseClient(
      request,
      redirectResponse,
    );
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email" | "signup" | "recovery" | "invite",
    });
    if (!error) {
      redirectResponse.headers.set("Cache-Control", "private, no-store");
      return redirectResponse;
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/error?error=Could+not+verify+your+account.+Please+try+again.`,
  );
}
