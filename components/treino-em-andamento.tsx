"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { lerRascunho, lerRotina } from "@/lib/local/db";

/**
 * Barra de "tem treino em andamento", em cima da barra de abas.
 *
 * O rascunho sempre existiu e sempre foi restaurado — mas só quando você
 * abria `/sessao` de novo. Fechar o app no meio do treino e reabrir caía na
 * tela de Início, sem nenhum sinal de que havia treino aberto: o dado estava
 * salvo e invisível.
 *
 * BARRA, E NÃO POPUP, de propósito. Pergunta de uma vez só é respondida errado
 * uma vez e some; a barra fica até você retomar, e não bloqueia o app enquanto
 * isso (às vezes você abre o app no meio do treino só pra ver outra coisa).
 *
 * NÃO OFERECE DESCARTAR. Descartar treino é irreversível e mora dentro da tela
 * de sessão, atrás de uma confirmação — não numa barra que o polegar encosta
 * sem querer ao mirar na aba de baixo.
 */

interface Rascunho {
  rotinaId: string | null;
  inicioEm: string;
  exercicios: { series: { concluida: boolean }[] }[];
}

export function TreinoEmAndamento() {
  const router = useRouter();
  const caminho = usePathname();
  const [info, setInfo] = useState<{ rotinaId: string | null; nome: string; desde: number } | null>(
    null,
  );
  const [agora, setAgora] = useState(() => Date.now());

  const conferir = useCallback(async () => {
    const r = await lerRascunho<Rascunho>();
    if (!r || !r.exercicios?.length) return setInfo(null);

    const rotina = r.rotinaId ? await lerRotina(r.rotinaId) : null;
    setInfo({
      rotinaId: r.rotinaId,
      nome: rotina?.nome ?? "Treino",
      desde: new Date(r.inicioEm).getTime(),
    });
  }, []);

  // Confere ao montar, ao trocar de tela e ao voltar pro app — este último é o
  // caso que importa: você fechou no meio do treino e abriu de novo.
  useEffect(() => {
    void conferir();
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void conferir();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [conferir, caminho]);

  useEffect(() => {
    if (!info) return;
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [info]);

  if (!info) return null;

  const min = Math.max(0, Math.floor((agora - info.desde) / 60_000));
  const tempo = min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;

  return (
    // `bottom` fixo em rem cortava a barra: a de abas tem altura mínima MAIS o
    // respiro da área segura do iPhone, que varia por aparelho. `calc` com a
    // própria variável do sistema resolve em qualquer tela.
    <div
      className="fixed inset-x-0 z-30 px-3"
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      <button
        onClick={() => router.push(info.rotinaId ? `/sessao?rotina=${info.rotinaId}` : "/sessao")}
        className="w-full rounded-2xl bg-accent text-black px-4 py-3 flex items-center gap-3 text-left shadow-lg"
      >
        <span className="size-2 rounded-full bg-black/70 animate-pulse shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold truncate">{info.nome} em andamento</span>
          <span className="block text-[11px] opacity-70">começou há {tempo}</span>
        </span>
        <span className="text-sm font-medium shrink-0">Retomar ›</span>
      </button>
    </div>
  );
}
