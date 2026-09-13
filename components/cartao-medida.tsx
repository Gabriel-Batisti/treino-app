import type { Faixa } from "@/lib/medidas/inbody";

/**
 * Um número do laudo com contexto: quanto mudou, onde cai na faixa normal e
 * como vinha evoluindo.
 *
 * A BARRA SÓ APARECE COM FAIXA DE VERDADE. As faixas do InBody são calculadas
 * pra altura e sexo da pessoa e vêm impressas no laudo — desenhar uma barra
 * "abaixo/normal/acima" com limites inventados por mim seria pior que não
 * desenhar nada, porque parece autoridade.
 *
 * Server Component: é só markup e um SVG.
 */

export interface PontoHistorico {
  data: string;
  valor: number;
}

export function CartaoMedida({
  rotulo,
  valor,
  sufixo = "",
  casas = 1,
  delta = null,
  faixa,
  historico = [],
  /** true quando subir é ruim (gordura, visceral). Só muda a cor do delta. */
  subirEhRuim = false,
}: {
  rotulo: string;
  valor: number | null;
  sufixo?: string;
  casas?: number;
  delta?: number | null;
  faixa?: Faixa;
  historico?: PontoHistorico[];
  subirEhRuim?: boolean;
}) {
  if (valor == null) return null;

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

  const deltaBom = delta == null ? null : subirEhRuim ? delta < 0 : delta > 0;

  return (
    <section className="rounded-2xl bg-card border border-border p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted">{rotulo}</p>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl tabular-nums">
          {fmt(valor)}
          <span className="text-sm text-muted">{sufixo}</span>
        </span>
        {delta != null && delta !== 0 && (
          <span
            className={`text-xs tabular-nums ${deltaBom ? "text-accent" : "text-amber-400"}`}
            title="desde o exame anterior"
          >
            {delta > 0 ? "↑" : "↓"} {fmt(Math.abs(delta))}
            {sufixo}
          </span>
        )}
      </div>

      {faixa && <BarraFaixa valor={valor} faixa={faixa} fmt={fmt} />}

      {historico.length > 1 && <Mini historico={historico} fmt={fmt} />}
    </section>
  );
}

/**
 * Onde o valor cai entre abaixo / normal / acima.
 *
 * A régua vai de 60% do mínimo a 140% do máximo pra que estar fora da faixa
 * ainda apareça dentro da barra — marcador encostado na borda não diz o quanto
 * está fora.
 */
function BarraFaixa({
  valor,
  faixa,
  fmt,
}: {
  valor: number;
  faixa: Faixa;
  fmt: (n: number) => string;
}) {
  const ini = faixa.min * 0.6;
  const fim = faixa.max * 1.4;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - ini) / (fim - ini)) * 100));

  const a = pos(faixa.min);
  const b = pos(faixa.max);
  const dentro = valor >= faixa.min && valor <= faixa.max;

  return (
    <div className="mt-3">
      <div className="relative h-6 rounded-full overflow-hidden bg-border/60">
        <div
          className={`absolute inset-y-0 ${dentro ? "bg-accent/30" : "bg-amber-400/25"}`}
          style={{ left: `${a}%`, width: `${b - a}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-2 text-[9px] uppercase tracking-wide text-muted">
          <span>abaixo</span>
          <span>normal</span>
          <span>acima</span>
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground"
          style={{ left: `${pos(valor)}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted tabular-nums">
        <span>{fmt(faixa.min)}</span>
        <span>{fmt(faixa.max)}</span>
      </div>
    </div>
  );
}

/** Linha do tempo do valor, com o primeiro e o último rotulados. */
function Mini({
  historico,
  fmt,
}: {
  historico: PontoHistorico[];
  fmt: (n: number) => string;
}) {
  const L = 260;
  const A = 48;
  const vs = historico.map((h) => h.valor);
  const max = Math.max(...vs);
  const min = Math.min(...vs);
  const folga = (max - min) * 0.2 || Math.max(0.5, max * 0.02);
  const alto = max + folga;
  const baixo = min - folga;

  const pts = historico.map((h, i) => {
    const x = historico.length === 1 ? L / 2 : (i / (historico.length - 1)) * L;
    const y = A - ((h.valor - baixo) / (alto - baixo)) * A;
    return { ...h, x, y };
  });

  const primeiro = pts[0];
  const ultimo = pts[pts.length - 1];
  const curta = (d: string) =>
    new Date(`${d}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });

  return (
    <svg viewBox={`-6 -14 ${L + 12} ${A + 32}`} className="mt-3 w-full" aria-hidden>
      <polyline
        points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={1.5}
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--foreground)" />
      ))}
      <text x={primeiro.x} y={primeiro.y - 6} fontSize={9} fill="var(--muted)" textAnchor="start">
        {fmt(primeiro.valor)}
      </text>
      <text x={ultimo.x} y={ultimo.y - 6} fontSize={9} fill="var(--foreground)" textAnchor="end">
        {fmt(ultimo.valor)}
      </text>
      <text x={0} y={A + 14} fontSize={8} fill="var(--muted)">
        {curta(primeiro.data)}
      </text>
      <text x={L} y={A + 14} fontSize={8} fill="var(--muted)" textAnchor="end">
        {curta(ultimo.data)}
      </text>
    </svg>
  );
}
