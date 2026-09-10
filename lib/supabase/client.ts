import { createBrowserClient } from "@supabase/ssr";

/** Client pro browser. A tela de sessão ativa (D-008) usa este. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
