import { Suspense } from "react";
import { SessaoCliente } from "./sessao-cliente";

/**
 * Casca estática. O conteúdo é client-side e lê do IndexedDB (D-007) — é isso
 * que permite ao service worker guardar esta tela e abri-la sem rede.
 *
 * O Suspense não é enfeite: `useSearchParams` num componente pré-renderizado
 * quebra o build sem ele.
 */
export default function SessaoPage() {
  return (
    <Suspense
      fallback={<main className="flex-1 grid place-items-center text-sm text-muted">carregando…</main>}
    >
      <SessaoCliente />
    </Suspense>
  );
}
