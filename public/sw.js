/*
 * Service worker escrito à mão. D-006.
 *
 * Sem isto o app NÃO ABRE sem rede — nem o HTML carrega — e o caso de uso é
 * exatamente chegar na academia com o app fora da memória e sinal ruim.
 *
 * Não usa next-pwa/Serwist de propósito: o AGENTS.md avisa que este Next não é
 * o Next conhecido, e amarrar o mínimo viável a um plugin que pode não suportar
 * Next 16 é risco desnecessário.
 *
 * ESTRATÉGIA, por tipo:
 *   navegação (HTML)  → rede primeiro, cache como rede de segurança
 *   _next/static      → cache primeiro (o nome do arquivo já tem hash)
 *   /ex/ (ilustração) → cache primeiro (imutável)
 *   resto             → passa direto
 *
 * NUNCA cacheia POST: Server Action é POST, e servir resposta velha de
 * gravação corromperia dado.
 */

// Trocar a versão invalida TUDO. É o botão de pânico quando o cache confunde.
const VERSAO = "v1";
const CACHE_APP = `treino-app-${VERSAO}`;

// Só o casco. As telas que precisam funcionar offline leem do IndexedDB, então
// o HTML delas não carrega dado — dá pra guardar sem medo de servir dado velho.
const PRECACHE = ["/rotinas", "/sessao", "/cardio", "/manifest.webmanifest"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_APP);
      // addAll falha inteiro se um item falhar; individual é mais tolerante.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      // Assume o controle já na primeira visita, sem esperar fechar as abas.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((n) => n.startsWith("treino-app-") && n !== CACHE_APP).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;

  // Gravação nunca passa por cache.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Imagem de exercício e bundle: o nome já identifica o conteúdo.
  if (url.pathname.startsWith("/ex/") || url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_APP);
        const guardado = await cache.match(req);
        if (guardado) return guardado;
        const resposta = await fetch(req);
        if (resposta.ok) cache.put(req, resposta.clone());
        return resposta;
      })(),
    );
    return;
  }

  // Navegação: rede primeiro (pra pegar deploy novo), cache como rede de
  // segurança. É o inverso do resto de propósito — servir HTML velho por
  // padrão é o bug clássico de PWA.
  if (req.mode === "navigate") {
    evento.respondWith(
      (async () => {
        try {
          const resposta = await fetch(req);
          if (resposta.ok) {
            const cache = await caches.open(CACHE_APP);
            cache.put(req, resposta.clone());
          }
          return resposta;
        } catch {
          const cache = await caches.open(CACHE_APP);
          return (
            (await cache.match(req)) ??
            (await cache.match("/sessao")) ??
            (await cache.match("/rotinas")) ??
            new Response("Sem conexão e sem cópia local desta tela.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
  }
});
