"use client";

import { useState } from "react";
import { formatData, formatDataCurta, formatPeso } from "@/lib/format";

export interface SerieDoExercicio {
  peso: number | null;
  reps: number | null;
  e1rm: number | null;
  volume: number | null;
}

export interface SessaoDoExercicio {
  data: string;
  treino: string | null;
  inicioEm: string;
  status: string;
  notas: string | null;
  series: SerieDoExercicio[];
}

type Aba = "resumo" | "historico" | "instrucoes";
type Metrica = "peso" | "e1rm" | "volume";

const ROTULO_METRICA: Record<Metrica, string> = {
  peso: "Maior peso",
  e1rm: "1RM estimado",
  volume: "Volume da sessão",
};

/** Um ponto por sessão, do mais antigo pro mais novo. */
function serie(sessoes: SessaoDoExercicio[], metrica: Metrica) {
  return [...sessoes]
    .reverse()
    .map((s) => {
      const valor =
        metrica === "volume"
          ? s.series.reduce((n, x) => n + Number(x.volume ?? 0), 0)
          : Math.max(0, ...s.series.map((x) => Number((metrica === "peso" ? x.peso : x.e1rm) ?? 0)));
      return { data: s.data, valor: Math.round(valor * 10) / 10 };
    })
    .filter((p) => p.valor > 0);
}

export function DetalheExercicio({
  sessoes,
  notasExercicio,
}: {
  sessoes: SessaoDoExercicio[];
  notasExercicio: string | null;
}) {
  const [aba, setAba] = useState<Aba>("resumo");
  const [metrica, setMetrica] = useState<Metrica>("peso");

  const pontos = serie(sessoes, metrica);
  const max = Math.max(...pontos.map((p) => p.valor), 1);
  const min = Math.min(...pontos.map((p) => p.valor), 0);
  const faixa = max - min || 1;
  const L = 300;
  const A = 90;
  const coords = pontos.map((p, i) => {
    const x = pontos.length === 1 ? L / 2 : (i / (pontos.length - 1)) * L;
    const y = A - ((p.valor - min) / faixa) * A;
    return [x, y] as const;
  });

  return (
    <>
      <div className="mt-5 px-4 flex gap-5 border-b border-border">
        {(
          [
            ["resumo", "Resumo"],
            ["historico", "Histórico"],
            ["instrucoes", "Instruções"],
          ] as [Aba, string][]
        ).map(([k, rotulo]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={`pb-2 text-sm border-b-2 -mb-px ${
              aba === k ? "border-accent text-accent" : "border-transparent text-muted"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "resumo" && (
        <section className="px-4 pt-4">
          {pontos.length > 1 ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-lg tabular-nums">
                  {pontos[pontos.length - 1].valor.toLocaleString("pt-BR")} kg
                </span>
                <span className="text-[11px] text-muted">
                  {pontos.length} sessões · desde {formatDataCurta(pontos[0].data)}
                </span>
              </div>
              <svg viewBox={`-4 -8 ${L + 8} ${A + 24}`} className="mt-2 w-full" role="img" aria-label={ROTULO_METRICA[metrica]}>
                <polyline
                  points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {coords.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 3.5 : 2} fill="var(--accent)" />
                ))}
                <text x={0} y={A + 14} fontSize={9} fill="var(--muted)">
                  {formatDataCurta(pontos[0].data)}
                </text>
                <text x={L} y={A + 14} fontSize={9} fill="var(--muted)" textAnchor="end">
                  {formatDataCurta(pontos[pontos.length - 1].data)}
                </text>
              </svg>
              <div className="mt-2 flex gap-2 flex-wrap">
                {(Object.keys(ROTULO_METRICA) as Metrica[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetrica(m)}
                    className={`rounded-full px-3 py-1.5 text-xs border ${
                      metrica === m
                        ? "bg-accent text-black border-accent font-medium"
                        : "bg-card text-muted border-border"
                    }`}
                  >
                    {ROTULO_METRICA[m]}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted py-8 text-center">
              Poucas sessões pra desenhar evolução.
            </p>
          )}
        </section>
      )}

      {aba === "historico" && (
        <section className="px-4 pt-4 flex flex-col gap-4">
          {sessoes.map((s, i) => (
            <div key={`${s.inicioEm}-${i}`} className="border-b border-border pb-3 last:border-0">
              <div className="flex items-baseline justify-between">
                <span className="text-sm">{s.treino ?? "Treino"}</span>
                <span className="text-[11px] text-muted">{formatData(s.data)}</span>
              </div>
              {s.notas && <p className="mt-0.5 text-[11px] text-muted italic">{s.notas}</p>}
              <div className="mt-1.5 flex flex-col gap-0.5">
                {s.series.map((x, j) => (
                  <div key={j} className="flex gap-3 text-xs tabular-nums">
                    <span className="w-4 text-muted">{j + 1}</span>
                    <span className="w-24">
                      {formatPeso(x.peso)} kg × {x.reps}
                    </span>
                    {x.e1rm != null && <span className="text-muted">1RM ~{formatPeso(x.e1rm)}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {sessoes.length === 0 && <p className="text-sm text-muted py-8 text-center">Sem histórico.</p>}
        </section>
      )}

      {aba === "instrucoes" && (
        <section className="px-4 pt-4">
          {notasExercicio ? (
            <p className="text-sm whitespace-pre-wrap">{notasExercicio}</p>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-muted">Sem instruções ainda.</p>
              {/* Ilustração do movimento: só existe base aberta com FOTO
                  estática (free-exercise-db, domínio público). Animação como a
                  do Hevy é proprietária. Decisão pendente com o usuário. */}
              <p className="mt-1 text-xs text-muted/70">
                Ilustração do movimento ainda não implementada.
              </p>
            </div>
          )}
        </section>
      )}

      <div className="h-8" />
    </>
  );
}
