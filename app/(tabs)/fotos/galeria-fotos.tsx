"use client";

import { useState } from "react";
import { formatData, formatDataCurta, formatPeso } from "@/lib/format";

/**
 * Galeria de acompanhamento, com dois modos.
 *
 * O modo COMPARAR é a razão de a tela existir: foto de progresso isolada não
 * diz nada, e ninguém percebe mudança rolando uma lista cronológica. Duas datas
 * lado a lado, mesmo ângulo, com o peso de cada uma — é ali que se vê.
 *
 * Por padrão compara a mais antiga com a mais recente, que é a comparação que
 * a pessoa quer ver em 90% das vezes.
 */

export interface FotoDaGaleria {
  id: string;
  angulo: string;
  url: string | null;
  largura: number | null;
  altura: number | null;
}

export interface DiaComFotos {
  data: string;
  pesoKg: number | null;
  fotos: FotoDaGaleria[];
}

const ROTULO_ANGULO: Record<string, string> = {
  frente: "Frente",
  lado: "Lado",
  costas: "Costas",
  outro: "Outro",
};

export function GaleriaFotos({ dias }: { dias: DiaComFotos[] }) {
  const [modo, setModo] = useState<"linha" | "comparar">(dias.length > 1 ? "comparar" : "linha");
  // `dias` vem do mais recente pro mais antigo.
  const [dataA, setDataA] = useState(dias[dias.length - 1]?.data ?? "");
  const [dataB, setDataB] = useState(dias[0]?.data ?? "");
  const [angulo, setAngulo] = useState<string>(dias[0]?.fotos[0]?.angulo ?? "frente");

  const angulos = [...new Set(dias.flatMap((d) => d.fotos.map((f) => f.angulo)))];

  return (
    <>
      {dias.length > 1 && (
        <div className="flex gap-2">
          {(["comparar", "linha"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`flex-1 rounded-xl border py-2.5 text-xs ${
                modo === m
                  ? "bg-accent text-black border-accent font-medium"
                  : "bg-card text-muted border-border"
              }`}
            >
              {m === "comparar" ? "Comparar" : "Linha do tempo"}
            </button>
          ))}
        </div>
      )}

      {modo === "comparar" && dias.length > 1 ? (
        <section className="mt-4">
          {angulos.length > 1 && (
            <div className="flex gap-2 mb-3">
              {angulos.map((a) => (
                <button
                  key={a}
                  onClick={() => setAngulo(a)}
                  className={`rounded-full px-3 py-1.5 text-xs border ${
                    angulo === a
                      ? "bg-accent text-black border-accent font-medium"
                      : "bg-card text-muted border-border"
                  }`}
                >
                  {ROTULO_ANGULO[a] ?? a}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {[
              [dataA, setDataA] as const,
              [dataB, setDataB] as const,
            ].map(([valor, definir], i) => {
              const dia = dias.find((d) => d.data === valor);
              const foto = dia?.fotos.find((f) => f.angulo === angulo) ?? dia?.fotos[0];
              return (
                <div key={i}>
                  <select
                    value={valor}
                    onChange={(e) => definir(e.target.value)}
                    aria-label={i === 0 ? "data à esquerda" : "data à direita"}
                    className="w-full rounded-lg bg-card border border-border px-2 py-2 text-xs outline-none focus:border-accent"
                  >
                    {dias.map((d) => (
                      <option key={d.data} value={d.data}>
                        {formatData(d.data)}
                      </option>
                    ))}
                  </select>

                  <div className="mt-2 rounded-xl overflow-hidden bg-card border border-border">
                    {foto?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={foto.url}
                        alt={`${ROTULO_ANGULO[foto.angulo] ?? foto.angulo} em ${formatData(valor)}`}
                        width={foto.largura ?? undefined}
                        height={foto.altura ?? undefined}
                        className="w-full h-auto"
                      />
                    ) : (
                      <div className="aspect-[3/4] grid place-items-center text-[11px] text-muted">
                        sem foto deste ângulo
                      </div>
                    )}
                  </div>

                  <p className="mt-1 text-center text-xs tabular-nums">
                    {dia?.pesoKg != null ? `${formatPeso(dia.pesoKg)} kg` : "—"}
                  </p>
                </div>
              );
            })}
          </div>

          {(() => {
            const a = dias.find((d) => d.data === dataA)?.pesoKg;
            const b = dias.find((d) => d.data === dataB)?.pesoKg;
            if (a == null || b == null) return null;
            const delta = Math.round((Number(b) - Number(a)) * 10) / 10;
            if (delta === 0) return null;
            return (
              <p className="mt-3 text-center text-sm">
                <span className={delta > 0 ? "text-amber-400" : "text-accent"}>
                  {delta > 0 ? "+" : ""}
                  {delta.toLocaleString("pt-BR")} kg
                </span>{" "}
                <span className="text-muted text-xs">entre as duas datas</span>
              </p>
            );
          })()}
        </section>
      ) : (
        <section className="mt-4 flex flex-col gap-6">
          {dias.map((dia) => (
            <div key={dia.data}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm">{formatData(dia.data)}</span>
                <span className="text-xs text-muted tabular-nums">
                  {dia.pesoKg != null ? `${formatPeso(dia.pesoKg)} kg` : ""}
                </span>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {dia.fotos.map((f) => (
                  <figure key={f.id} className="shrink-0 w-40">
                    <div className="rounded-xl overflow-hidden bg-card border border-border">
                      {f.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.url}
                          alt={`${ROTULO_ANGULO[f.angulo] ?? f.angulo} em ${formatDataCurta(dia.data)}`}
                          loading="lazy"
                          className="w-full h-auto"
                        />
                      ) : (
                        <div className="aspect-[3/4] grid place-items-center text-[11px] text-muted">
                          indisponível
                        </div>
                      )}
                    </div>
                    <figcaption className="mt-1 text-center text-[11px] text-muted">
                      {ROTULO_ANGULO[f.angulo] ?? f.angulo}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
