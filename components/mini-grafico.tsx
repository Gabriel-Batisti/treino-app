"use client";

import { useRef, useState } from "react";

/**
 * Linha do tempo de um número do laudo, varrível com o dedo.
 *
 * Mesmo gesto dos outros gráficos do app, e o mesmo `touch-action: pan-y`:
 * arrastar de lado varre, arrastar pra cima rola a página.
 *
 * O eixo X é a SEQUÊNCIA de exames, não o tempo. Bioimpedância é evento
 * espaçado e irregular; o que se lê aqui é "como foi de um exame pro outro".
 */

export interface PontoHistorico {
  data: string;
  valor: number;
}

const L = 260;
const A = 54;

export function MiniGrafico({
  historico,
  casas = 1,
}: {
  historico: PontoHistorico[];
  /**
   * Casas decimais. Recebe o NÚMERO, não a função de formatar: função não
   * atravessa a fronteira servidor→cliente, e quem desenha isto é Client.
   */
  casas?: number;
}) {
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

  const [ativo, setAtivo] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  if (historico.length < 2) return null;

  const vs = historico.map((h) => h.valor);
  const max = Math.max(...vs);
  const min = Math.min(...vs);
  const folga = (max - min) * 0.2 || Math.max(0.5, max * 0.02);
  const alto = max + folga;
  const baixo = min - folga;

  const pts = historico.map((h, i) => ({
    ...h,
    x: (i / (historico.length - 1)) * L,
    y: A - ((h.valor - baixo) / (alto - baixo)) * A,
  }));

  const foco = ativo != null ? pts[ativo] : null;

  const curta = (d: string) =>
    new Date(`${d}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });

  function varrer(clienteX: number) {
    const caixa = svg.current?.getBoundingClientRect();
    if (!caixa) return;
    const x = ((clienteX - caixa.left) / caixa.width) * (L + 12) - 6;
    const passo = L / (pts.length - 1);
    setAtivo(Math.max(0, Math.min(pts.length - 1, Math.round(x / passo))));
  }

  return (
    <svg
      ref={svg}
      viewBox={`-6 -16 ${L + 12} ${A + 34}`}
      className="mt-3 w-full select-none"
      style={{ touchAction: "pan-y" }}
      role="img"
      aria-label="evolução"
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
        points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--accent)" />
      ))}

      {foco ? (
        <g>
          <line
            x1={foco.x}
            y1={-10}
            x2={foco.x}
            y2={A}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <circle cx={foco.x} cy={foco.y} r={5} fill="var(--accent)" />
          <text
            x={Math.min(Math.max(foco.x, 24), L - 24)}
            y={-4}
            fontSize={10}
            fill="var(--foreground)"
            textAnchor="middle"
          >
            {fmt(foco.valor)} · {curta(foco.data)}
          </text>
        </g>
      ) : (
        <>
          <text x={pts[0].x} y={pts[0].y - 7} fontSize={9} fill="var(--muted)">
            {fmt(pts[0].valor)}
          </text>
          <text
            x={pts[pts.length - 1].x}
            y={pts[pts.length - 1].y - 7}
            fontSize={9}
            fill="var(--foreground)"
            textAnchor="end"
          >
            {fmt(pts[pts.length - 1].valor)}
          </text>
        </>
      )}

      <text x={0} y={A + 16} fontSize={8} fill="var(--muted)">
        {curta(pts[0].data)}
      </text>
      <text x={L} y={A + 16} fontSize={8} fill="var(--muted)" textAnchor="end">
        {curta(pts[pts.length - 1].data)}
      </text>
    </svg>
  );
}
