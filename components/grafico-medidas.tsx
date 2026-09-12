"use client";

import { useMemo, useRef, useState } from "react";
import { formatData, formatDataCurta } from "@/lib/format";

/**
 * Gráfico das medidas, com o dedo em cima e troca de métrica.
 *
 * SVG à mão, sem biblioteca: Recharts custa ~100 KB pra desenhar uma linha, e
 * este app abre na academia com sinal ruim.
 *
 * O EIXO X É O TEMPO, não a posição na lista. Bioimpedância é de dois em dois
 * meses e pesagem é diária; espaçar por índice colocaria dois exames com um ano
 * de diferença lado a lado com a mesma distância de duas pesagens seguidas — o
 * gráfico mentiria sobre o ritmo da mudança.
 *
 * `touch-action: pan-y` é o detalhe que faz isso funcionar no celular: arrastar
 * de lado varre o gráfico, arrastar pra cima continua rolando a página. Com
 * `none` o gráfico prenderia a rolagem; sem nada, o iOS rolaria a página no
 * meio da varredura.
 */

export interface MedidaGrafico {
  data_local: string;
  peso_kg: number;
  gordura_pct: number | null;
  massa_magra_kg: number | null;
  massa_muscular_kg: number | null;
  massa_gorda_kg: number | null;
  agua_pct: number | null;
  tmb_kcal: number | null;
}

type Campo = Exclude<keyof MedidaGrafico, "data_local">;

const METRICAS: { campo: Campo; rotulo: string; sufixo: string; casas: number }[] = [
  { campo: "peso_kg", rotulo: "Peso", sufixo: " kg", casas: 1 },
  { campo: "gordura_pct", rotulo: "Gordura", sufixo: "%", casas: 1 },
  { campo: "massa_muscular_kg", rotulo: "Músculo", sufixo: " kg", casas: 1 },
  { campo: "massa_magra_kg", rotulo: "Massa magra", sufixo: " kg", casas: 1 },
  { campo: "massa_gorda_kg", rotulo: "Gordura", sufixo: " kg", casas: 1 },
  { campo: "agua_pct", rotulo: "Água", sufixo: "%", casas: 1 },
  { campo: "tmb_kcal", rotulo: "Metabolismo", sufixo: " kcal", casas: 0 },
];

const L = 300;
const ALTURA = 130;

/** Meio-dia local: `new Date("2026-08-02")` seria UTC e voltaria um dia. */
const instante = (dia: string) => new Date(`${dia}T12:00:00-03:00`).getTime();

export function GraficoMedidas({ medidas }: { medidas: MedidaGrafico[] }) {
  const [campo, setCampo] = useState<Campo>("peso_kg");
  const [ativo, setAtivo] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  // Só oferece a métrica que tem linha pra desenhar — chip que abre um gráfico
  // vazio é pior que chip que não existe.
  const disponiveis = useMemo(
    () => METRICAS.filter((m) => medidas.filter((x) => x[m.campo] != null).length > 1),
    [medidas],
  );

  const metrica = disponiveis.find((m) => m.campo === campo) ?? disponiveis[0];

  const serie = useMemo(() => {
    if (!metrica) return [];
    return medidas
      .filter((m) => m[metrica.campo] != null)
      .map((m) => ({ t: instante(m.data_local), dia: m.data_local, valor: Number(m[metrica.campo]) }))
      .sort((a, b) => a.t - b.t);
  }, [medidas, metrica]);

  const geo = useMemo(() => {
    if (serie.length < 2) return null;
    const valores = serie.map((p) => p.valor);
    const max = Math.max(...valores);
    const min = Math.min(...valores);
    // Folga proporcional: peso corporal mexe pouco e sem isto a linha vira um
    // risco reto colado na borda.
    const folga = (max - min) * 0.15 || Math.max(1, max * 0.02);
    const alto = max + folga;
    const baixo = min - folga;
    const t0 = serie[0].t;
    const t1 = serie[serie.length - 1].t;
    const span = t1 - t0 || 1;
    const pts = serie.map((p) => ({
      ...p,
      x: ((p.t - t0) / span) * L,
      y: ALTURA - ((p.valor - baixo) / (alto - baixo)) * ALTURA,
    }));
    return { pts, min, max };
  }, [serie]);

  if (!metrica || !geo) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Registre mais de um dia pra ver a evolução.
      </p>
    );
  }

  const { pts } = geo;
  const atual = ativo != null ? pts[ativo] : pts[pts.length - 1];
  const primeiro = pts[0];
  const delta = atual.valor - primeiro.valor;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", {
      minimumFractionDigits: metrica.casas,
      maximumFractionDigits: metrica.casas,
    });

  /** Ponto mais próximo do dedo, em coordenadas do próprio SVG. */
  function varrer(clienteX: number) {
    const caixa = svg.current?.getBoundingClientRect();
    if (!caixa) return;
    const x = ((clienteX - caixa.left) / caixa.width) * (L + 8) - 4;
    let perto = 0;
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i].x - x) < Math.abs(pts[perto].x - x)) perto = i;
    }
    setAtivo(perto);
  }

  return (
    <div>
      {disponiveis.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {disponiveis.map((m) => (
            <button
              key={m.campo}
              onClick={() => {
                setCampo(m.campo);
                setAtivo(null);
              }}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs ${
                m.campo === metrica.campo
                  ? "bg-accent text-black border-accent font-medium"
                  : "bg-card border-border text-muted"
              }`}
            >
              {m.rotulo}
              {m.sufixo.trim() === "kg" && m.campo === "massa_gorda_kg" ? " (kg)" : ""}
            </button>
          ))}
        </div>
      )}

      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-2xl tabular-nums">
          {fmt(atual.valor)}
          <span className="text-sm text-muted">{metrica.sufixo}</span>
        </span>
        <span className="text-[11px] text-muted tabular-nums">
          {ativo != null ? formatData(atual.dia) : formatDataCurta(atual.dia)}
          {pts.length > 1 && (
            <span className={`ml-2 ${delta > 0 ? "text-amber-400" : "text-accent"}`}>
              {delta > 0 ? "+" : ""}
              {fmt(delta)}
              {metrica.sufixo} desde {formatDataCurta(primeiro.dia)}
            </span>
          )}
        </span>
      </div>

      <svg
        ref={svg}
        viewBox={`-4 -6 ${L + 8} ${ALTURA + 22}`}
        className="mt-2 w-full select-none"
        style={{ touchAction: "pan-y" }}
        role="img"
        aria-label={`evolução de ${metrica.rotulo}`}
        onPointerDown={(e) => {
          // Capturar o ponteiro é o que mantém a varredura viva quando o dedo
          // sai do SVG. Falhar não pode derrubar a varredura — daí o try.
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
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.map((p, i) => (
          <circle
            key={p.dia + i}
            cx={p.x}
            cy={p.y}
            r={i === pts.length - 1 && ativo == null ? 3.5 : 1.8}
            fill="var(--accent)"
          />
        ))}

        {ativo != null && (
          <g>
            <line
              x1={atual.x}
              y1={-4}
              x2={atual.x}
              y2={ALTURA}
              stroke="var(--muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={atual.x} cy={atual.y} r={5} fill="var(--accent)" />
            <circle cx={atual.x} cy={atual.y} r={9} fill="var(--accent)" opacity={0.2} />
          </g>
        )}

        <text x={0} y={ALTURA + 14} fontSize={9} fill="var(--muted)">
          {formatDataCurta(pts[0].dia)}
        </text>
        <text x={L} y={ALTURA + 14} fontSize={9} fill="var(--muted)" textAnchor="end">
          {formatDataCurta(pts[pts.length - 1].dia)}
        </text>
      </svg>

      <p className="mt-1 text-center text-[10px] text-muted">
        {ativo != null ? "solte pra voltar ao último" : "arraste o dedo sobre o gráfico"}
      </p>
    </div>
  );
}
