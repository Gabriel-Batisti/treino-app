import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirma link de e-mail (magic link, convite, recuperação de senha).
 *
 * Usa `verifyOtp` com `token_hash` — e não troca de `code` — porque links
 * gerados no servidor não têm o verifier do PKCE guardado no browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const proximo = searchParams.get("next") ?? "/";

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/login?erro=link_invalido", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    return NextResponse.redirect(new URL("/login?erro=link_expirado", request.url));
  }
  return NextResponse.redirect(new URL(proximo, request.url));
}
