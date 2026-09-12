"use client";

import { useRef, useState } from "react";
import { formatDataCurta } from "@/lib/format";

/**
 * Gráfico de evolução da rotina. SVG à mão, sem biblioteca.
 *
 * Recharts custaria ~100 KB no bundle pra desenhar uma linha — e este app abre
 * na academia com sinal ruim. Uma polilinha resolve.
 *
 * Varre com o dedo, igual ao gráfico de peso. `touch-action: pan-y` é o que
 * faz isso conviver com a rolagem: arrastar de lado varre, arrastar pra cima
 * rola a página.
 *
 * O eixo X é a SEQUÊNCIA de sessões, não o tempo — aqui a pergunta é "como foi
 * evoluindo treino a treino", e sessão pulada não deixa buraco na linha. (No
 * gráfico de peso é o contrário, e por isso lá o eixo é o tempo.)
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
  const [ativo, setAtivo] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

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
  const emFoco = ativo != null ? pontos[ativo] : ultimo;

  /** Ponto mais próximo do dedo, em coordenadas do próprio SVG. */
  function varrer(clienteX: number) {
    const caixa = svg.current?.getBoundingClientRect();
    if (!caixa || pontos.length === 0) return;
    const x = ((clienteX - caixa.left) / caixa.width) * (L + 8) - 4;
    const passo = pontos.length === 1 ? L : L / (pontos.length - 1);
    const i = Math.round(x / passo);
    setAtivo(Math.max(0, Math.min(pontos.length - 1, i)));
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-medium tabular-nums">
          {emFoco[metrica].toLocaleString("pt-BR")}
          {SUFIXO[metrica]}
        </span>
        <span className="text-[11px] text-muted">
          {ativo != null
            ? formatDataCurta(emFoco.data)
            : `${pontos.length} sessões · desde ${formatDataCurta(pontos[0].data)}`}
        </span>
      </div>

      <svg
        ref={svg}
        viewBox={`-4 -8 ${L + 8} ${A + 24}`}
        className="mt-2 w-full select-none"
        style={{ touchAction: "pan-y" }}
        role="img"
        aria-label={`${ROTULOS[metrica]} por sessão`}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ponteiro já solto */
          }
          varrer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0 && e.pointerType === "mouse") return;
          if (ativo != null || e.pointerType !== "mouse") varrer(e.clientX);
        }}
        onPointerUp={() => setAtivo(null)}
        onPointerCancel={() => setAtivo(null)}
        onPointerLeave={() => setAtivo(null)}
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
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === pontos.length - 1 && ativo == null ? 3.5 : 2}
              fill="var(--accent)"
            />
          );
        })}

        {ativo != null &&
          (() => {
            const [x, y] = coordenadas[ativo].split(",");
            return (
              <g>
                <line
                  x1={x}
                  y1={-6}
                  x2={x}
                  y2={A}
                  stroke="var(--muted)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle cx={x} cy={y} r={9} fill="var(--accent)" opacity={0.2} />
                <circle cx={x} cy={y} r={5} fill="var(--accent)" />
              </g>
            );
          })()}
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
