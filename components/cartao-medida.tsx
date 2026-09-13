import type { Faixa } from "@/lib/medidas/inbody";
import { MiniGrafico, type PontoHistorico } from "@/components/mini-grafico";

export type { PontoHistorico };

/**
 * Um número do laudo com contexto: quanto mudou, onde cai na faixa normal e
 * como vinha evoluindo.
 *
 * A BARRA SÓ APARECE COM FAIXA DE VERDADE. As faixas do InBody são calculadas
 * pra altura e sexo da pessoa e vêm impressas no laudo — desenhar uma barra
 * "abaixo/normal/acima" com limites inventados por mim seria pior que não
 * desenhar nada, porque parece autoridade.
 */
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
  /** Linha extra abaixo do número — usada pro peso de hoje, por exemplo. */
  nota,
}: {
  rotulo: string;
  valor: number | null;
  sufixo?: string;
  casas?: number;
  delta?: number | null;
  faixa?: Faixa;
  historico?: PontoHistorico[];
  subirEhRuim?: boolean;
  nota?: string | null;
}) {
  if (valor == null) return null;

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

  const deltaBom = delta == null ? null : subirEhRuim ? delta < 0 : delta > 0;

  return (
    <section className="rounded-2xl bg-card border border-border p-4">
      <p className="text-xs font-medium text-foreground">{rotulo}</p>

      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
        <span className="text-3xl tabular-nums">
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

      {nota && <p className="mt-0.5 text-[11px] text-muted">{nota}</p>}

      {faixa && <BarraFaixa valor={valor} faixa={faixa} fmt={fmt} />}

      <MiniGrafico historico={historico} casas={casas} />
    </section>
  );
}

/**
 * Onde o valor cai entre abaixo / normal / acima.
 *
 * Cada rótulo é CENTRADO NA SUA FAIXA, e não distribuído na barra: "normal"
 * flutuando à esquerda do trecho normal faz ler a barra errado, que é o
 * oposto do ponto dela.
 *
 * A régua vai de 60% do mínimo a 140% do máximo pra que estar fora ainda
 * apareça dentro da barra — marcador colado na borda não diz o quanto está
 * fora.
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
  const marcador = pos(valor);

  const trechos = [
    { rotulo: "abaixo", left: 0, width: a, destaque: valor < faixa.min },
    { rotulo: "normal", left: a, width: b - a, destaque: dentro },
    { rotulo: "acima", left: b, width: 100 - b, destaque: valor > faixa.max },
  ];

  // Onde o valor caiu ganha fundo e texto cheio; o resto fica legível, mas
  // claramente secundário. Antes os três eram igualmente apagados e a barra
  // não dizia nada de relance — que é como ela é lida.
  const corDoTrecho = (destaque: boolean) =>
    destaque
      ? dentro
        ? "bg-accent/30 text-foreground font-semibold"
        : "bg-amber-400/30 text-foreground font-semibold"
      : "text-foreground/55";

  return (
    <div className="mt-3">
      <div className="relative h-8 rounded-lg overflow-hidden bg-border/30">
        {trechos.map((t) => (
          <span
            key={t.rotulo}
            className={`absolute inset-y-0 grid place-items-center text-[10px] uppercase tracking-wide ${corDoTrecho(
              t.destaque,
            )}`}
            style={{ left: `${t.left}%`, width: `${t.width}%` }}
          >
            {t.width > 14 ? t.rotulo : ""}
          </span>
        ))}

        {/* O marcador é o que você procura primeiro: linha grossa e uma
            bolinha em cima, pra achar mesmo de longe e com a barra colorida
            atrás. */}
        <div
          className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-foreground rounded-full"
          style={{ left: `${marcador}%` }}
          aria-hidden
        />
        <div
          className="absolute top-1 size-2 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: `${marcador}%` }}
          aria-hidden
        />
      </div>
      <div className="relative mt-1 h-3">
        <span
          className="absolute text-[10px] text-muted tabular-nums -translate-x-1/2"
          style={{ left: `${a}%` }}
        >
          {fmt(faixa.min)}
        </span>
        <span
          className="absolute text-[10px] text-muted tabular-nums -translate-x-1/2"
          style={{ left: `${b}%` }}
        >
          {fmt(faixa.max)}
        </span>
      </div>
    </div>
  );
}
