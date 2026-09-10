"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Registra o service worker e GARANTE o cache das telas offline (D-006).
 *
 * Por que o aquecimento mora aqui e não no `install` do SW: `install` só roda
 * quando o script muda. Se o cache for apagado depois — e o Safari apaga
 * storage — o worker continua "activated" e o precache NUNCA é refeito. O app
 * então falha offline em silêncio, que é o pior modo de falhar.
 *
 * Fazendo daqui, toda abertura do app reconfere. `cache.add` de algo que já
 * está lá é barato, e a página divide o mesmo CacheStorage do worker.
 *
 * O prefetch das rotas é a outra metade: o SW só guarda o que passa por ele, e
 * os bundles de uma rota só são baixados quando você a visita. Sem isso, quem
 * nunca tivesse aberto /sessao com internet abriria tela em branco na academia.
 *
 * Em desenvolvimento fica de fora: SW guardando bundle do dev server é receita
 * de "por que minha alteração não aparece".
 */

/** ⚠️ Tem que ser idêntico ao CACHE_APP de public/sw.js. */
const CACHE_APP = "treino-app-v1";

/** Telas que precisam abrir sem rede. Manter em sincronia com PRECACHE do sw.js. */
const ROTAS_OFFLINE = ["/rotinas", "/sessao", "/cardio"];

async function aquecerCache(): Promise<void> {
  try {
    const cache = await caches.open(CACHE_APP);
    // Uma de cada vez, de propósito: as quatro em paralelo falharam na prática
    // (só a primeira entrava). São quatro requisições pequenas — serializar não
    // custa nada e é o que funciona.
    for (const url of [...ROTAS_OFFLINE, "/manifest.webmanifest"]) {
      try {
        await cache.add(url);
      } catch {
        /* uma tela que falhe não pode impedir as outras */
      }
    }
  } catch {
    /* CacheStorage bloqueado — o app segue, só não abre offline */
  }
}

/**
 * Guarda os bundles da página atual.
 *
 * O SW cacheia estático que passa por ele, mas no carregamento normal os
 * scripts vêm do cache HTTP e não chegam lá — na prática o cache ficava com as
 * telas e ZERO JavaScript, o que faria a tela abrir em branco offline. Varrer o
 * DOM é determinístico: o que a página carregou é exatamente o que ela precisa.
 */
async function aquecerEstaticos(): Promise<void> {
  try {
    const cache = await caches.open(CACHE_APP);
    const urls = [
      ...[...document.querySelectorAll<HTMLScriptElement>('script[src^="/_next/"]')].map((s) => s.getAttribute("src")),
      ...[...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((l) => l.getAttribute("href")),
    ].filter((u): u is string => !!u && u.startsWith("/_next/"));

    for (const url of urls) {
      if (await cache.match(url)) continue; // já guardado, não rebaixa
      try {
        await cache.add(url);
      } catch {
        /* um chunk que falhe não pode impedir os outros */
      }
    }
  } catch {
    /* CacheStorage bloqueado */
  }
}

/**
 * Carrega cada tela offline uma vez, escondida, pra os bundles dela passarem
 * pelo service worker e entrarem no cache.
 *
 * Por que iframe e não `router.prefetch`: o chunk de uma rota é carregado por
 * import dinâmico e NÃO vira <script> no DOM, então nem a varredura o vê nem o
 * prefetch o baixa. Sem isto, abrir /sessao offline sem nunca ter aberto online
 * trava em "carregando…" — foi o que aconteceu no teste.
 *
 * O iframe roda o JS da tela, o que é inofensivo: ela só lê do IndexedDB.
 */
async function aquecerRotasEmIframe(): Promise<void> {
  for (const rota of ROTAS_OFFLINE) {
    await new Promise<void>((resolve) => {
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;border:0;left:-9999px";
      const encerrar = () => {
        frame.remove();
        resolve();
      };
      frame.addEventListener("load", () => setTimeout(encerrar, 1200));
      // Não deixa um erro segurar a fila.
      setTimeout(encerrar, 8000);
      frame.src = rota;
      document.body.appendChild(frame);
    });
  }
}

export function RegistrarSW() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    // ⚠️ DENTRO DE IFRAME NÃO FAZ NADA. Sem isto, cada iframe de aquecimento
    // carrega a página, que roda este componente, que cria mais três iframes —
    // explosão exponencial. Aconteceu.
    if (window.top !== window.self) return;

    // SEM guard de cancelamento no meio do aquecimento. Tinha um, e ele era o
    // bug: o efeito depende de `router`, então uma troca de rota disparava a
    // limpeza e a cadeia abortava EXATAMENTE entre cachear as telas e cachear
    // os scripts — o cache ficava com HTML e zero JavaScript. Guardar um
    // arquivo depois de desmontar é inofensivo; abrir em branco na academia não.
    const temporizadores: ReturnType<typeof setTimeout>[] = [];

    (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        await aquecerCache();
        await aquecerEstaticos();

        // Espera a tela assentar antes de puxar os bundles das outras rotas.
        temporizadores.push(
          setTimeout(async () => {
            for (const rota of ROTAS_OFFLINE) router.prefetch(rota);
            await aquecerRotasEmIframe();
            await aquecerEstaticos();
          }, 2000),
        );
      } catch {
        /* sem SW o app segue funcionando, só não abre offline */
      }
    })();

    return () => {
      for (const t of temporizadores) clearTimeout(t);
    };
  }, [router]);

  return null;
}
