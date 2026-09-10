"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { salvarSessao } from "@/app/actions/treino";
import { hojeLocal, formatPeso, haQuantoTempo } from "@/lib/format";
import { e1rm } from "@/lib/treino/calc";

/**
 * A TELA DE SESSÃO ATIVA — inverte o default do projeto de propósito (D-008).
 *
 * O resto do app é Server Component + Server Action. Aqui não: round-trip por
 * série é incompatível com o uso (uma mão, 40s entre séries, sinal ruim). Todo
 * o estado é local e a sessão sobe INTEIRA ao finalizar.
 *
 * Não "corrija" isto pro padrão do projeto. Está registrado no CLAUDE.md.
 */

export interface SerieAnterior {
  indice: number;
  pesoKg: number | null;
  reps: number | null;
  e1rm: number | null;
}

export interface ExercicioDaSessao {
  exercicioId: string;
  nome: string;
  modoMedicao: string;
  anterior: SerieAnterior[];
  anteriorEm: string | null;
}

interface SerieEmAndamento {
  id: string;
  indice: number;
  pesoKg: number | null;
  reps: number | null;
  concluida: boolean;
  registradaEm: string | null;
}

interface ExercicioEmAndamento extends ExercicioDaSessao {
  id: string;
  series: SerieEmAndamento[];
}

function novaSerie(indice: number): SerieEmAndamento {
  return { id: crypto.randomUUID(), indice, pesoKg: null, reps: null, concluida: false, registradaEm: null };
}

/** Monta as linhas a partir do "anterior": mesma quantidade de séries da última vez. */
function montarExercicio(e: ExercicioDaSessao): ExercicioEmAndamento {
  const qtd = Math.max(e.anterior.length, 1);
  return {
    ...e,
    id: crypto.randomUUID(),
    series: Array.from({ length: qtd }, (_, i) => {
      const s = novaSerie(i + 1);
      // Peso entra PREENCHIDO (raramente muda). Reps fica como placeholder —
      // preencher os dois faria você registrar série que não fez.
      s.pesoKg = e.anterior[i]?.pesoKg ?? null;
      return s;
    }),
  };
}

export function SessaoAtiva({
  nomeModelo,
  exerciciosIniciais,
}: {
  nomeModelo: string | null;
  exerciciosIniciais: ExercicioDaSessao[];
}) {
  const router = useRouter();
  const inicioRef = useRef(new Date().toISOString());
  const [exercicios, setExercicios] = useState<ExercicioEmAndamento[]>(() =>
    exerciciosIniciais.map(montarExercicio),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [decorrido, setDecorrido] = useState(0);

  // Cronômetro por DIFERENÇA DE TIMESTAMP, não por contador incrementado: o
  // iOS congela timer com o app em background e um contador ficaria pra trás.
  useEffect(() => {
    const tick = () =>
      setDecorrido(Math.floor((Date.now() - new Date(inicioRef.current).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const mm = String(Math.floor(decorrido / 60)).padStart(2, "0");
  const ss = String(decorrido % 60).padStart(2, "0");
  const feitas = exercicios.reduce((n, e) => n + e.series.filter((s) => s.concluida).length, 0);

  function alterar(exIdx: number, sIdx: number, campo: "pesoKg" | "reps", valor: number | null) {
    setExercicios((prev) => {
      const cp = structuredClone(prev);
      cp[exIdx].series[sIdx][campo] = valor;
      return cp;
    });
  }

  /** ✓ com os campos vazios commita o anterior inteiro — o "fiz igual" num toque. */
  function concluir(exIdx: number, sIdx: number) {
    setExercicios((prev) => {
      const cp = structuredClone(prev);
      const ex = cp[exIdx];
      const s = ex.series[sIdx];
      if (s.concluida) {
        s.concluida = false;
        s.registradaEm = null;
        return cp;
      }
      const ant = ex.anterior[sIdx] ?? ex.anterior[ex.anterior.length - 1];
      if (s.pesoKg == null) s.pesoKg = ant?.pesoKg ?? null;
      if (s.reps == null) s.reps = ant?.reps ?? null;
      if (s.reps == null) return cp; // sem reps não há série
      s.concluida = true;
      s.registradaEm = new Date().toISOString();
      return cp;
    });
  }

  function addSerie(exIdx: number) {
    setExercicios((prev) => {
      const cp = structuredClone(prev);
      const ex = cp[exIdx];
      const nova = novaSerie(ex.series.length + 1);
      nova.pesoKg = ex.series[ex.series.length - 1]?.pesoKg ?? null;
      ex.series.push(nova);
      return cp;
    });
  }

  async function finalizar() {
    setSalvando(true);
    setErro(null);
    const r = await salvarSessao({
      id: crypto.randomUUID(),
      nome: nomeModelo,
      inicio_em: inicioRef.current,
      fim_em: new Date().toISOString(),
      data_local: hojeLocal(),
      notas: null,
      exercicios: exercicios.map((e, i) => ({
        id: e.id,
        exercicio_id: e.exercicioId,
        ordem: i,
        nome_snapshot: e.nome,
        modo_medicao_snapshot: e.modoMedicao,
        notas: null,
        series: e.series.map((s) => ({
          id: s.id,
          indice: s.indice,
          tipo: "normal" as const,
          peso_kg: s.pesoKg,
          reps: s.reps,
          rpe: null,
          concluida: s.concluida,
          registrada_em: s.registradaEm ?? new Date().toISOString(),
        })),
      })),
    });
    if (!r.ok) {
      setErro(r.error);
      setSalvando(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe px-4 pt-6 pb-3 sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">{nomeModelo ?? "Treino livre"}</h1>
          <span className="tabular-nums text-sm text-muted">{mm}:{ss}</span>
        </div>
        <p className="text-xs text-muted mt-0.5">
          {feitas} {feitas === 1 ? "série feita" : "séries feitas"}
        </p>
      </header>

      <div className="flex-1 px-4 py-4 flex flex-col gap-6">
        {exercicios.length === 0 && (
          <p className="text-sm text-muted py-12 text-center">
            Treino livre ainda não tem seletor de exercício.
            <br />Volte e escolha um treino da lista.
          </p>
        )}

        {exercicios.map((ex, exIdx) => (
          <section key={ex.id}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-medium">{ex.nome}</h2>
              {ex.anteriorEm && (
                <span className="text-[11px] text-muted shrink-0">{haQuantoTempo(ex.anteriorEm)}</span>
              )}
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              {ex.series.map((s, sIdx) => {
                const ant = ex.anterior[sIdx];
                const est = e1rm(s.pesoKg, s.reps);
                const bateu = ant?.e1rm != null && est != null && est > ant.e1rm;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="w-5 text-center text-xs text-muted tabular-nums">{s.indice}</span>

                    {/* O "anterior" em cinza — a informação mais importante da tela. */}
                    <span className="w-20 text-[11px] text-muted tabular-nums shrink-0">
                      {ant ? `${formatPeso(ant.pesoKg)}×${ant.reps}` : "—"}
                    </span>

                    <input
                      inputMode="decimal" placeholder={ant ? formatPeso(ant.pesoKg) : "kg"}
                      value={s.pesoKg ?? ""}
                      onChange={(e) => alterar(exIdx, sIdx, "pesoKg", e.target.value === "" ? null : Number(e.target.value.replace(",", ".")))}
                      className="w-full min-w-0 rounded-lg bg-card border border-border px-2 py-3 text-center tabular-nums outline-none focus:border-accent"
                    />
                    <input
                      inputMode="numeric" placeholder={ant?.reps != null ? String(ant.reps) : "reps"}
                      value={s.reps ?? ""}
                      onChange={(e) => alterar(exIdx, sIdx, "reps", e.target.value === "" ? null : Number(e.target.value))}
                      className="w-full min-w-0 rounded-lg bg-card border border-border px-2 py-3 text-center tabular-nums outline-none focus:border-accent"
                    />

                    {/* 44×44pt — mínimo da HIG da Apple, com a mão suada. */}
                    <button
                      onClick={() => concluir(exIdx, sIdx)}
                      aria-label={s.concluida ? "desmarcar série" : "concluir série"}
                      className={`size-11 shrink-0 rounded-lg border text-lg ${
                        s.concluida
                          ? bateu
                            ? "bg-accent text-black border-accent"
                            : "bg-foreground text-black border-foreground"
                          : "bg-card border-border text-muted"
                      }`}
                    >
                      ✓
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => addSerie(exIdx)}
              className="mt-2 w-full rounded-lg border border-dashed border-border py-2.5 text-xs text-muted"
            >
              + série
            </button>
          </section>
        ))}
      </div>

      {erro && <p className="px-4 pb-2 text-sm text-red-400">{erro}</p>}

      {/* Ação primária na zona do polegar. */}
      <div className="sticky bottom-0 px-4 pt-2 pb-safe bg-background/95 backdrop-blur border-t border-border">
        <button
          onClick={finalizar}
          disabled={salvando || feitas === 0}
          className="w-full rounded-2xl bg-accent text-black font-semibold py-5 text-base disabled:opacity-30"
        >
          {salvando ? "salvando…" : `Finalizar treino${feitas ? ` (${feitas})` : ""}`}
        </button>
      </div>
    </main>
  );
}
