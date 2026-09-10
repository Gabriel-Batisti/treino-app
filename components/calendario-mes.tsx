"use client";

import { useState } from "react";

/**
 * Mini calendário com os dias ativos do mês.
 *
 * Recebe as datas já prontas como "AAAA-MM-DD" (data_local, D-012) — nada de
 * `new Date()` sobre timestamp aqui, senão o treino das 22h aparece no dia
 * seguinte.
 */

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export interface DiaAtivo {
  data: string;
  treino: boolean;
  cardio: boolean;
}

export function CalendarioMes({ dias, hoje }: { dias: DiaAtivo[]; hoje: string }) {
  const [ano, mes] = hoje.split("-").map(Number);
  const [visivel, setVisivel] = useState({ ano, mes });

  const porData = new Map(dias.map((d) => [d.data, d]));

  const primeiro = new Date(visivel.ano, visivel.mes - 1, 1);
  const totalDias = new Date(visivel.ano, visivel.mes, 0).getDate();
  const vazios = primeiro.getDay();

  const ativosNoMes = dias.filter((d) =>
    d.data.startsWith(`${visivel.ano}-${String(visivel.mes).padStart(2, "0")}`),
  ).length;

  function mover(delta: number) {
    setVisivel(({ ano, mes }) => {
      const m = mes + delta;
      if (m < 1) return { ano: ano - 1, mes: 12 };
      if (m > 12) return { ano: ano + 1, mes: 1 };
      return { ano, mes: m };
    });
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => mover(-1)} aria-label="mês anterior" className="size-9 -ml-2 grid place-items-center text-muted text-lg">
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-medium capitalize">
            {MESES[visivel.mes - 1]} {visivel.ano}
          </p>
          <p className="text-[11px] text-muted">
            {ativosNoMes} {ativosNoMes === 1 ? "dia ativo" : "dias ativos"}
          </p>
        </div>
        <button onClick={() => mover(1)} aria-label="próximo mês" className="size-9 -mr-2 grid place-items-center text-muted text-lg">
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1.5 text-center">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="text-[10px] text-muted">{d}</span>
        ))}
        {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: totalDias }, (_, i) => {
          const dia = i + 1;
          const data = `${visivel.ano}-${String(visivel.mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          const ativo = porData.get(data);
          const ehHoje = data === hoje;
          return (
            <span key={data} className="grid place-items-center">
              <span
                className={`size-7 grid place-items-center rounded-full text-[11px] tabular-nums ${
                  ativo?.treino
                    ? "bg-accent text-black font-medium"
                    : ativo?.cardio
                      ? "border border-accent text-accent"
                      : ehHoje
                        ? "border border-muted text-foreground"
                        : "text-muted"
                }`}
              >
                {dia}
              </span>
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-accent" /> treino
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-accent" /> cardio
        </span>
      </div>
    </div>
  );
}
