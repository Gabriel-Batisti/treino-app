"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MiniGrafico } from "@/components/mini-grafico";

/**
 * O peso na tela de Início: cartão fechado por padrão, gráfico ao tocar.
 *
 * A COMPARAÇÃO PRECISA DE PRAZO. "−0,3 kg" sem dizer desde quando não informa
 * nada: peso oscila 1 kg entre a manhã e a noite, então a diferença pra ontem é
 * ruído e a diferença pro mês passado é tendência. Aqui o prazo é escolhido e
 * fica guardado.
 *
 * A comparação é com a pesagem MAIS PRÓXIMA do início do período, não com a
 * média — média esconde justamente o que você quer ver, que é o movimento.
 */

const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
  { dias: 0, rotulo: "tudo" },
] as const;

const CHAVE = "peso-periodo";

export interface PontoPeso {
  data: string;
  valor: number;
}

export function CartaoPeso({
  historico,
  pesouHoje,
}: {
  /** Do mais antigo pro mais novo. */
  historico: PontoPeso[];
  pesouHoje: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [dias, setDias] = useState<number>(30);

  // A escolha fica no aparelho: é preferência de leitura, não dado do treino.
  useEffect(() => {
    try {
      // `Number(null)` é 0 — que por azar é o código de "tudo". Sem checar a
      // string antes, o cartão abria sempre em "tudo" na primeira vez.
      const cru = localStorage.getItem(CHAVE);
      if (cru === null) return;
      const salvo = Number(cru);
      if (PERIODOS.some((p) => p.dias === salvo)) setDias(salvo);
    } catch {
      /* storage bloqueado — segue com 30 dias */
    }
  }, []);

  function escolher(d: number) {
    setDias(d);
    try {
      localStorage.setItem(CHAVE, String(d));
    } catch {
      /* ignora */
    }
  }

  if (historico.length === 0) {
    return (
      <Link
        href="/corpo/medidas"
        className="mx-4 mt-3 rounded-2xl bg-card border border-border px-4 py-3.5 flex items-center justify-between gap-3"
      >
        <span className="text-[10px] uppercase tracking-wide text-muted">Peso</span>
        <span className="text-xs text-accent">registrar hoje ›</span>
      </Link>
    );
  }

  const atual = historico[historico.length - 1];

  const corte =
    dias === 0
      ? historico[0].data
      : new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);

  // A primeira pesagem DENTRO da janela. Se não houver nenhuma além da atual,
  // não há o que comparar — e o cartão fica quieto em vez de inventar.
  const naJanela = historico.filter((p) => p.data >= corte);
  const base = naJanela.length > 1 ? naJanela[0] : null;
  const delta = base ? Math.round((atual.valor - base.valor) * 10) / 10 : null;

  const rotuloPeriodo = PERIODOS.find((p) => p.dias === dias)?.rotulo ?? "";

  return (
    <section className="mx-4 mt-3 rounded-2xl bg-card border border-border ring-1 ring-accent/15">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted">Peso</p>
          <p className="tabular-nums">
            {atual.valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
            {delta != null && Math.abs(delta) >= 0.05 && (
              <span className={`ml-2 text-xs ${delta > 0 ? "text-amber-400" : "text-accent"}`}>
                {delta > 0 ? "+" : ""}
                {delta.toLocaleString("pt-BR")}
                <span className="text-muted"> em {rotuloPeriodo}</span>
              </span>
            )}
          </p>
        </div>
        <span className="flex items-center gap-2 shrink-0">
          <span className={`text-xs ${pesouHoje ? "text-muted" : "text-accent"}`}>
            {pesouHoje ? "registrado hoje" : "registrar hoje"}
          </span>
          <span className={`text-muted transition-transform ${aberto ? "rotate-180" : ""}`}>
            ⌄
          </span>
        </span>
      </button>

      {aberto && (
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                onClick={() => escolher(p.dias)}
                className={`flex-1 rounded-lg border py-2 text-[11px] ${
                  p.dias === dias
                    ? "bg-accent text-black border-accent font-medium"
                    : "bg-background border-border text-muted"
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>

          {naJanela.length > 1 ? (
            <MiniGrafico historico={naJanela} casas={1} />
          ) : (
            <p className="py-6 text-center text-xs text-muted">
              Só uma pesagem neste período.
            </p>
          )}

          <Link
            href="/corpo/medidas"
            className="mt-1 block w-full rounded-xl border border-border py-3 text-center text-xs"
          >
            {pesouHoje ? "Ver e corrigir" : "Registrar peso de hoje"}
          </Link>
        </div>
      )}
    </section>
  );
}
