/**
 * Gráfico de linha em SVG, sem biblioteca.
 *
 * Recharts custaria ~100 KB no bundle pra desenhar uma linha, e este app abre
 * na academia com sinal ruim. Server Component: é só markup.
 */

export interface PontoGrafico {
  /** Rótulo do eixo X — já formatado por quem chama. */
  rotulo: string;
  valor: number;
}

export function GraficoLinha({
  pontos,
  sufixo = "",
  altura = 90,
}: {
  pontos: PontoGrafico[];
  sufixo?: string;
  altura?: number;
}) {
  if (pontos.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Registre mais de um dia pra ver a evolução.
      </p>
    );
  }

  const valores = pontos.map((p) => p.valor);
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  // Margem de 5% pra a linha não encostar nas bordas quando a variação é pequena
  // — peso corporal mexe pouco, e sem isto o gráfico vira uma linha reta colada.
  const folga = (max - min) * 0.15 || 1;
  const alto = max + folga;
  const baixo = min - folga;
  const faixa = alto - baixo;

  const L = 300;
  const coords = pontos.map((p, i) => {
    const x = (i / (pontos.length - 1)) * L;
    const y = altura - ((p.valor - baixo) / faixa) * altura;
    return [x, y] as const;
  });

  return (
    <svg viewBox={`-4 -8 ${L + 8} ${altura + 24}`} className="w-full" role="img" aria-label="evolução">
      <polyline
        points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 3.5 : 1.8} fill="var(--accent)" />
      ))}
      <text x={0} y={altura + 14} fontSize={9} fill="var(--muted)">
        {pontos[0].rotulo}
      </text>
      <text x={L} y={altura + 14} fontSize={9} fill="var(--muted)" textAnchor="end">
        {pontos[pontos.length - 1].rotulo}
      </text>
      <text x={L} y={-1} fontSize={9} fill="var(--muted)" textAnchor="end">
        {pontos[pontos.length - 1].valor.toLocaleString("pt-BR")}
        {sufixo}
      </text>
    </svg>
  );
}
