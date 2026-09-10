import { NextResponse, type NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/proxy";

/**
 * No Next 16 o `middleware.ts` foi renomeado pra `proxy.ts` e a função exportada
 * chama `proxy`. Mesma semântica.
 *
 * REGRA (D-009): o gate de auth NÃO fica na frente do shell offline. Falha de
 * refresh bloqueia SINCRONIZAÇÃO, nunca USO. Quando o service worker entrar,
 * `/treino` tem que renderizar do IndexedDB mesmo sem sessão válida — por isso
 * essa rota está fora do matcher. Redirecionar ela pra /login mataria o
 * requisito de abrir na academia sem sinal.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await atualizarSessao(request);
  const { pathname } = request.nextUrl;

  // `/auth/*` NUNCA pode cair no gate: é justamente onde a sessão nasce.
  // Sem esta linha, o link de e-mail (magic link, recuperação de senha) é
  // redirecionado pro /login antes do route handler rodar, e nunca funciona.
  const rotaDeAuth = pathname.startsWith("/auth");

  if (!user && !rotaDeAuth && !pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !rotaDeAuth && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Tudo, menos estáticos, imagens, o service worker e a rota de treino.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|treino|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
