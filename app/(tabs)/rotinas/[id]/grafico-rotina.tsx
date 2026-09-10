"use client";

import { useState } from "react";
import { formatDataCurta } from "@/lib/format";

/**
 * Gráfico de evolução da rotina. SVG à mão, sem biblioteca.
 *
 * Recharts custaria ~100 KB no bundle pra desenhar uma linha — e este app abre
 * na academia com sinal ruim. Uma polilinha resolve.
 */

export interface PontoSessao {
  data: string;
  duracaoMin: number;
  volumeKg: number;
  reps: number;
}

type Metrica = "volumeKg" | "reps" | "duracaoMin";

const ROTULOS: Record<Metrica, string> = {
  volumeKg: "Volume",
  reps: "Repetições",
  duracaoMin: "Duração",
};

const SUFIXO: Record<Metrica, string> = { volumeKg: " kg", reps: "", duracaoMin: " min" };

export function GraficoRotina({ pontos }: { pontos: PontoSessao[] }) {
  const [metrica, setMetrica] = useState<Metrica>("volumeKg");

  const valores = pontos.map((p) => p[metrica]);
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const faixa = max - min || 1;

  const L = 300;
  const A = 90;
  const coordenadas = pontos.map((p, i) => {
    const x = pontos.length === 1 ? L / 2 : (i / (pontos.length - 1)) * L;
    const y = A - ((p[metrica] - min) / faixa) * A;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const ultimo = pontos[pontos.length - 1];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-medium tabular-nums">
          {ultimo[metrica].toLocaleString("pt-BR")}
          {SUFIXO[metrica]}
        </span>
        <span className="text-[11px] text-muted">
          {pontos.length} sessões · desde {formatDataCurta(pontos[0].data)}
        </span>
      </div>

      <svg
        viewBox={`-4 -8 ${L + 8} ${A + 24}`}
        className="mt-2 w-full"
        role="img"
        aria-label={`${ROTULOS[metrica]} por sessão`}
      >
        <polyline
          points={coordenadas.join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coordenadas.map((c, i) => {
          const [x, y] = c.split(",");
          return <circle key={i} cx={x} cy={y} r={i === pontos.length - 1 ? 3.5 : 2} fill="var(--accent)" />;
        })}
        <text x={0} y={A + 14} fontSize={9} fill="var(--muted)">
          {formatDataCurta(pontos[0].data)}
        </text>
        <text x={L} y={A + 14} fontSize={9} fill="var(--muted)" textAnchor="end">
          {formatDataCurta(ultimo.data)}
        </text>
      </svg>

      <div className="mt-2 flex gap-2">
        {(Object.keys(ROTULOS) as Metrica[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetrica(m)}
            className={`rounded-full px-3 py-1.5 text-xs border ${
              metrica === m
                ? "bg-accent text-black border-accent font-medium"
                : "bg-card text-muted border-border"
            }`}
          >
            {ROTULOS[m]}
          </button>
        ))}
      </div>
    </div>
  );
}
