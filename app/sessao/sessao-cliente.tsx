"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SessaoAtiva, type ExercicioDaSessao } from "./sessao-ativa";
import { lerRotina, lerDesempenho } from "@/lib/local/db";

/**
 * A TELA DE TREINO LÊ DO INDEXEDDB. D-007.
 *
 * Antes isto era um Server Component que buscava a rotina e o "anterior" ao
 * abrir. Furo: offline no minuto zero você entrava no treino sem saber o que
 * fez da última vez — que é o motivo principal do app existir.
 *
 * Agora o HTML é estático (o service worker guarda), e os dados vêm do
 * aparelho. Sem rede, funciona igual.
 */
export function SessaoCliente() {
  const params = useSearchParams();
  const rotinaId = params.get("rotina");
  const [estado, setEstado] = useState<{
    nome: string | null;
    exercicios: ExercicioDaSessao[];
  } | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!rotinaId) {
        if (vivo) setEstado({ nome: null, exercicios: [] });
        return;
      }
      const rotina = await lerRotina(rotinaId);
      if (!rotina) {
        if (vivo) setEstado({ nome: null, exercicios: [] });
        return;
      }
      const anteriores = await lerDesempenho(rotina.exercicios.map((e) => e.exercicioId));
      if (!vivo) return;

      setEstado({
        nome: rotina.nome,
        exercicios: rotina.exercicios.map((e) => {
          const d = anteriores.get(e.exercicioId);
          return {
            exercicioId: e.exercicioId,
            nome: e.nome,
            modoMedicao: e.modoMedicao,
            seriesAlvo: e.seriesAlvo ?? Math.max(d?.series.length ?? 0, 1),
            repsAlvoMin: e.repsAlvoMin,
            repsAlvoMax: e.repsAlvoMax,
            descansoSeg: e.descansoSeg,
            anterior: d?.series ?? [],
            anteriorEm: d?.dataLocal ?? null,
          };
        }),
      });
    })();
    return () => {
      vivo = false;
    };
  }, [rotinaId]);

  if (estado === null) {
    return <main className="flex-1 grid place-items-center text-sm text-muted">carregando…</main>;
  }

  return (
    <SessaoAtiva
      nomeRotina={estado.nome}
      rotinaId={rotinaId}
      exerciciosIniciais={estado.exercicios}
    />
  );
}
