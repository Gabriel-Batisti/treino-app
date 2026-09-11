import { Suspense } from "react";
import { EditarRotina } from "./editar-rotina";

/**
 * Casca estática; o conteúdo é client-side e lê a rotina do IndexedDB.
 *
 * Ler do local mesmo sendo uma tela online: é a mesma forma de dado que a tela
 * de treino usa, e evita uma segunda consulta no servidor só pra montar um
 * formulário. GRAVAR exige rede — e a tela diz isso quando falha, em vez de
 * fingir que salvou.
 */
export default function EditarRotinaPage() {
  return (
    <Suspense
      fallback={<main className="flex-1 grid place-items-center text-sm text-muted">carregando…</main>}
    >
      <EditarRotina />
    </Suspense>
  );
}
