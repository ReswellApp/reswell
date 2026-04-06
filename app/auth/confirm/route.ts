import { trackKlaviyoWelcome } from "@/lib/klaviyo/track-welcome";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Handles email confirmation links from Supabase
// These come in the format: /auth/confirm?token_hash=xxx&type=signup
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "email"
    | "signup"
    | "recovery"
    | "invite"
    | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (!error && data.user && type === "signup") {
      void trackKlaviyoWelcome({ user: data.user });
    }

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/error?error=Could+not+confirm+your+email.+Please+try+again.`
  );
}
