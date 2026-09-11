"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { enfileirar } from "@/lib/local/db";
import { sincronizar } from "@/lib/local/sync";
import { hojeLocal, formatPeso, haQuantoTempo } from "@/lib/format";
import { e1rm, volume } from "@/lib/treino/calc";
import { SeletorExercicio } from "@/components/seletor-exercicio";
import { lerDesempenho, type ExercicioLocal } from "@/lib/local/db";

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
  seriesAlvo: number;
  repsAlvoMin: number | null;
  repsAlvoMax: number | null;
  descansoSeg: number | null;
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
  notas: string;
  series: SerieEmAndamento[];
}

function novaSerie(indice: number): SerieEmAndamento {
  return {
    id: crypto.randomUUID(),
    indice,
    pesoKg: null,
    reps: null,
    concluida: false,
    registradaEm: null,
  };
}

/** Quantidade de linhas = alvo da rotina, ou o que foi feito da última vez. */
function montarExercicio(e: ExercicioDaSessao): ExercicioEmAndamento {
  const qtd = Math.max(e.seriesAlvo, e.anterior.length, 1);
  return {
    ...e,
    id: crypto.randomUUID(),
    notas: "",
    series: Array.from({ length: qtd }, (_, i) => {
      const s = novaSerie(i + 1);
      // Peso entra PREENCHIDO (raramente muda). Reps fica como placeholder —
      // preencher os dois faria você registrar série que não fez.
      s.pesoKg = e.anterior[i]?.pesoKg ?? e.anterior[e.anterior.length - 1]?.pesoKg ?? null;
      return s;
    }),
  };
}

function mmss(seg: number): string {
  const m = Math.floor(Math.abs(seg) / 60);
  const s = Math.abs(seg) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDescanso(seg: number | null): string {
  if (!seg) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return s ? `${m}min ${s}s` : `${m}min 0s`;
}

export function SessaoAtiva({
  nomeRotina,
  exerciciosIniciais,
}: {
  nomeRotina: string | null;
  exerciciosIniciais: ExercicioDaSessao[];
}) {
  const router = useRouter();
  const inicioRef = useRef(new Date().toISOString());
  const [exercicios, setExercicios] = useState<ExercicioEmAndamento[]>(() =>
    exerciciosIniciais.map(montarExercicio),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  /** Timestamp em que o descanso acaba. Guardo o FIM, não o restante. */
  const [descansoAte, setDescansoAte] = useState<number | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);

  // Cronômetro por DIFERENÇA DE TIMESTAMP, não por contador incrementado: o
  // iOS congela timer com o app em background e um contador ficaria pra trás.
  // Mesmo motivo pro descanso guardar o instante final.
  useEffect(() => {
    const tick = () => setAgora(Date.now());
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  // Mantém a tela acesa durante o treino (iOS 16.4+). Falha em silêncio onde
  // não existe — é conforto, não requisito.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const pedir = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        /* negado ou sem suporte */
      }
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      lock?.release().catch(() => {});
    };
  }, []);

  const decorrido = Math.floor((agora - new Date(inicioRef.current).getTime()) / 1000);
  const restante = descansoAte ? Math.round((descansoAte - agora) / 1000) : null;

  const feitas = exercicios.reduce((n, e) => n + e.series.filter((s) => s.concluida).length, 0);
  const volumeTotal = exercicios.reduce(
    (n, e) =>
      n + e.series.filter((s) => s.concluida).reduce((v, s) => v + (volume(s.pesoKg, s.reps) ?? 0), 0),
    0,
  );

  const alterar = useCallback(
    (exIdx: number, sIdx: number, campo: "pesoKg" | "reps", valor: number | null) => {
      setExercicios((prev) => {
        const cp = structuredClone(prev);
        cp[exIdx].series[sIdx][campo] = valor;
        return cp;
      });
    },
    [],
  );

  /** ✓ com os campos vazios commita o anterior inteiro — o "fiz igual" num toque. */
  function concluir(exIdx: number, sIdx: number) {
    let iniciarDescanso: number | null = null;
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
      iniciarDescanso = ex.descansoSeg ?? null;
      return cp;
    });
    if (iniciarDescanso) setDescansoAte(Date.now() + iniciarDescanso * 1000);
    navigator.vibrate?.(30);
  }

  /**
   * Acrescenta um exercício à sessão em andamento.
   *
   * Não toca na rotina de propósito: máquina ocupada é coisa do dia, não
   * mudança de plano. Editar a rotina é outra ação, em outra tela.
   */
  async function addExercicio(e: ExercicioLocal) {
    setSeletorAberto(false);

    // BUSCA O "ANTERIOR" (D-005). Sem isto, adicionar um exercício que você já
    // fez 61 vezes mostrava "—" no lugar da carga da última sessão — o
    // contrário do que o app existe pra fazer. O dado já está no aparelho.
    const mapa = await lerDesempenho([e.id]);
    const d = mapa.get(e.id);
    const anterior = d?.series ?? [];
    const quantasSeries = Math.max(anterior.length, 3);

    setExercicios((prev) => [
      ...prev,
      {
        exercicioId: e.id,
        nome: e.nome,
        modoMedicao: e.modoMedicao,
        seriesAlvo: quantasSeries,
        repsAlvoMin: null,
        repsAlvoMax: null,
        // Herda o descanso do exercício anterior: o padrão do treino de hoje
        // diz mais que um valor fixo.
        descansoSeg: prev[prev.length - 1]?.descansoSeg ?? 120,
        anterior,
        anteriorEm: d?.dataLocal ?? null,
        id: crypto.randomUUID(),
        notas: "",
        series: Array.from({ length: quantasSeries }, (_, i) => {
          const serie = novaSerie(i + 1);
          // Mesma regra da rotina: peso entra preenchido, reps fica placeholder.
          serie.pesoKg = anterior[i]?.pesoKg ?? anterior[anterior.length - 1]?.pesoKg ?? null;
          return serie;
        }),
      },
    ]);
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

  /**
   * Grava NO APARELHO e só então tenta subir. Nunca falha por falta de rede:
   * o treino é o dado irreversível, e o requisito é a academia sem sinal
   * (D-007). O upload vira problema do Sincronizador.
   */
  async function finalizar() {
    setSalvando(true);
    setErro(null);
    const sessaoId = crypto.randomUUID();
    const payload = {
      id: sessaoId,
      nome: nomeRotina,
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
        notas: e.notas.trim() || null,
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
    };

    await enfileirar({ id: sessaoId, tipo: "sessao", payload });
    // Dispara sem esperar: se não houver rede, fica na fila e sobe depois.
    void sincronizar();
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 flex items-center justify-between gap-3">
          <h1 className="text-lg font-medium truncate">{nomeRotina ?? "Treino livre"}</h1>
          <button
            onClick={finalizar}
            disabled={salvando || feitas === 0}
            className="shrink-0 rounded-full bg-accent text-black font-semibold px-5 py-2 text-sm disabled:opacity-30"
          >
            {salvando ? "…" : "Concluir"}
          </button>
        </div>

        <div className="px-4 py-3 grid grid-cols-3 gap-2">
          {[
            ["Duração", mmss(decorrido)],
            ["Volume", `${Math.round(volumeTotal).toLocaleString("pt-BR")} kg`],
            ["Séries", String(feitas)],
          ].map(([rotulo, valor]) => (
            <div key={rotulo}>
              <p className="text-[10px] uppercase tracking-wide text-muted">{rotulo}</p>
              <p className="text-base tabular-nums">{valor}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="flex-1 px-4 py-4 flex flex-col gap-7">
        {exercicios.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted">Treino vazio.</p>
            <button
              onClick={() => setSeletorAberto(true)}
              className="mt-4 rounded-2xl bg-accent text-black font-semibold px-6 py-4 text-sm"
            >
              ＋ Adicionar exercício
            </button>
          </div>
        )}

        {exercicios.map((ex, exIdx) => (
          <section key={ex.id}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-medium text-accent">{ex.nome}</h2>
              {ex.anteriorEm && (
                <span className="text-[11px] text-muted shrink-0">{haQuantoTempo(ex.anteriorEm)}</span>
              )}
            </div>

            <input
              value={ex.notas}
              placeholder="Adicione notas aqui…"
              onChange={(e) =>
                setExercicios((prev) => {
                  const cp = structuredClone(prev);
                  cp[exIdx].notas = e.target.value;
                  return cp;
                })
              }
              className="mt-1 w-full bg-transparent text-xs text-muted outline-none placeholder:text-muted/60"
            />

            <p className="mt-1 text-[11px] text-muted">
              ⏱ Descanso: {formatDescanso(ex.descansoSeg)}
            </p>

            <div className="mt-2 grid grid-cols-[1.6rem_4.2rem_1fr_1fr_2.75rem] gap-2 text-[10px] uppercase tracking-wide text-muted">
              <span className="text-center">Sér</span>
              <span>Anterior</span>
              <span className="text-center">Kg</span>
              <span className="text-center">Reps</span>
              <span />
            </div>

            <div className="mt-1 flex flex-col gap-1.5">
              {ex.series.map((s, sIdx) => {
                const ant = ex.anterior[sIdx];
                const est = e1rm(s.pesoKg, s.reps);
                const bateu = ant?.e1rm != null && est != null && est > ant.e1rm;
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[1.6rem_4.2rem_1fr_1fr_2.75rem] gap-2 items-center"
                  >
                    <span className="text-center text-xs text-muted tabular-nums">{s.indice}</span>

                    {/* O "anterior" — a informação mais importante da tela. */}
                    <span className="text-[11px] text-muted tabular-nums">
                      {ant ? `${formatPeso(ant.pesoKg)}kg × ${ant.reps}` : "—"}
                    </span>

                    <input
                      inputMode="decimal"
                      placeholder={ant ? formatPeso(ant.pesoKg) : "kg"}
                      value={s.pesoKg ?? ""}
                      onChange={(e) =>
                        alterar(
                          exIdx,
                          sIdx,
                          "pesoKg",
                          e.target.value === "" ? null : Number(e.target.value.replace(",", ".")),
                        )
                      }
                      className="min-w-0 rounded-lg bg-card border border-border px-1 py-3 text-center tabular-nums outline-none focus:border-accent"
                    />
                    <input
                      inputMode="numeric"
                      // Placeholder = faixa alvo da rotina, igual ao Hevy.
                      placeholder={
                        ex.repsAlvoMin && ex.repsAlvoMax
                          ? `${ex.repsAlvoMin}-${ex.repsAlvoMax}`
                          : ant?.reps != null
                            ? String(ant.reps)
                            : "reps"
                      }
                      value={s.reps ?? ""}
                      onChange={(e) =>
                        alterar(exIdx, sIdx, "reps", e.target.value === "" ? null : Number(e.target.value))
                      }
                      className="min-w-0 rounded-lg bg-card border border-border px-1 py-3 text-center tabular-nums outline-none focus:border-accent"
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
              + Adicionar série
            </button>
          </section>
        ))}

        {exercicios.length > 0 && (
          <button
            onClick={() => setSeletorAberto(true)}
            className="w-full rounded-2xl border border-dashed border-border py-4 text-sm text-muted"
          >
            ＋ Adicionar exercício
          </button>
        )}
      </div>

      {seletorAberto && (
        <SeletorExercicio
          aoEscolher={addExercicio}
          aoFechar={() => setSeletorAberto(false)}
          jaNaSessao={exercicios.map((e) => e.exercicioId)}
        />
      )}

      {erro && <p className="px-4 pb-2 text-sm text-red-400">{erro}</p>}

      {/* Timer de descanso, na zona do polegar. Aparece só quando está correndo. */}
      {restante !== null && restante > -3 && (
        <div className="sticky bottom-0 px-4 pt-2 pb-safe bg-background/95 backdrop-blur border-t border-border">
          <div className="flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3">
            <span className="text-xs text-muted">Descanso</span>
            <span
              className={`text-2xl tabular-nums font-medium ${restante <= 0 ? "text-accent" : ""}`}
            >
              {restante <= 0 ? "acabou" : mmss(restante)}
            </span>
            <button
              onClick={() => setDescansoAte(null)}
              className="ml-auto text-xs text-muted px-3 py-2"
            >
              pular
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
