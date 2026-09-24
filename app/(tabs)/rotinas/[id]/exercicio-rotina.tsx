"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { atualizarDescanso } from "@/app/actions/rotinas";
import { formatPeso } from "@/lib/format";
import { Ilustracao } from "@/components/ilustracao";

/**
 * Um exercício dentro do detalhe da rotina — tabela de séries + descanso
 * editável, no formato do Hevy.
 *
 * O KG de cada linha NÃO é alvo salvo: é o que você levantou naquela série da
 * última vez. A rotina hoje guarda séries, faixa de reps e descanso; peso-alvo
 * por série exigiria uma tabela `rotina_series`, que ainda não existe.
 */

export interface LinhaSerieAlvo {
  indice: number;
  pesoAnterior: number | null;
}

export interface ExercicioRotinaProps {
  rotinaId: string;
  rotinaExercicioId: string;
  exercicioId: string;
  nome: string;
  nomeBusca: string;
  seriesAlvo: number;
  /** Quantas das ÚLTIMAS séries são backup. Contadas dentro de seriesAlvo. */
  seriesBackup: number;
  repsAlvoMin: number | null;
  repsAlvoMax: number | null;
  descansoSeg: number | null;
  /** Prescrição escrita pelo coach. Só leitura. */
  notas: string | null;
  /** A ÚLTIMA série vai até a falha e ignora a faixa de reps? */
  backupAteFalha: boolean;
  linhas: LinhaSerieAlvo[];
}

/** Opções em passos que fazem sentido na academia, não um campo livre. */
const OPCOES_DESCANSO = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

function rotuloDescanso(seg: number | null): string {
  if (!seg) return "Desligado";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  if (!m) return `${s}s`;
  return s ? `${m}min ${s}s` : `${m}min 0s`;
}

export function ExercicioRotina(props: ExercicioRotinaProps) {
  const [descanso, setDescanso] = useState(props.descansoSeg ?? 0);
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();

  const faixa =
    props.repsAlvoMin && props.repsAlvoMax ? `${props.repsAlvoMin}-${props.repsAlvoMax}` : "—";

  function escolher(seg: number) {
    const anterior = descanso;
    setDescanso(seg); // otimista
    setAberto(false);
    iniciar(async () => {
      const r = await atualizarDescanso({
        rotinaExercicioId: props.rotinaExercicioId,
        rotinaId: props.rotinaId,
        descansoSeg: seg,
      });
      if (!r.ok) setDescanso(anterior); // reverte se o servidor recusar
    });
  }

  return (
    <section>
      <Link href={`/exercicios/${props.exercicioId}`} className="flex items-center gap-3">
        <Ilustracao nomeBusca={props.nomeBusca} className="size-12" />
        <span className="text-accent font-medium leading-tight">{props.nome}</span>
      </Link>

      {props.notas && (
        <p className="mt-2 rounded-xl border border-border bg-card px-3 py-2.5 text-[11px] leading-relaxed text-muted whitespace-pre-line">
          {props.notas}
        </p>
      )}

      <div className="mt-2 relative">
        <button
          onClick={() => setAberto((v) => !v)}
          className={`text-[11px] ${pendente ? "opacity-50" : ""} text-accent`}
        >
          ⏱ Timer de descanso: {rotuloDescanso(descanso)}
        </button>

        {aberto && (
          <div className="absolute z-20 mt-1 rounded-xl bg-card border border-border p-1 shadow-lg">
            {OPCOES_DESCANSO.map((seg) => (
              <button
                key={seg}
                onClick={() => escolher(seg)}
                className={`block w-32 text-left px-3 py-2.5 text-xs rounded-lg ${
                  seg === descanso ? "bg-accent text-black font-medium" : "text-foreground"
                }`}
              >
                {rotuloDescanso(seg)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 text-[10px] uppercase tracking-wide text-muted border-b border-border pb-1">
          <span>Série</span>
          <span className="text-center">Kg</span>
          <span className="text-center">Faixa de repetições</span>
        </div>
        {props.linhas.map((l) => {
          // As ÚLTIMAS são backup — mesma regra da sessão, e tem que ser a
          // mesma: a rotina prometendo uma coisa e o treino mostrando outra é
          // pior que não marcar nada.
          const backup = l.indice > props.linhas.length - props.seriesBackup;
          return (
            <div
              key={l.indice}
              className="grid grid-cols-[3rem_1fr_1fr] gap-2 py-2.5 border-b border-border/50 text-sm tabular-nums"
            >
              <span className={backup ? "text-amber-400 text-xs" : "text-muted"}>
                {backup ? "backup" : l.indice}
              </span>
              <span className="text-center">
                {l.pesoAnterior != null ? formatPeso(l.pesoAnterior) : "—"}
              </span>
              {/*
                A falha é da ÚLTIMA SÉRIE, não de toda backup — foi o segundo
                erro seguido aqui. Primeiro "até a falha" era texto fixo em
                toda linha de backup; depois virou "toda backup deste
                exercício", o que ainda estava errado no Muscle Round: dos
                dois blocos do drop, só o sexto vai à falha, o quinto tem
                alvo de 4 reps. Nos dois casos a falha é a última linha.
              */}
              <span className="text-center">
                {props.backupAteFalha && l.indice === props.linhas.length
                  ? "até a falha"
                  : faixa}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
