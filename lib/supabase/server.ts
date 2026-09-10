import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client pra Server Components e Server Actions.
 *
 * `cookies()` é ASSÍNCRONA no Next 16 — sempre `await`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component não pode escrever cookie. Tudo bem: quem renova
            // a sessão é o proxy.ts, e é de lá que sai o Set-Cookie (D-009).
          }
        },
      },
    },
  );
}
