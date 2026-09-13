"use client";

import { useState } from "react";
import type { Segmento } from "@/lib/medidas/inbody";

/**
 * Análise segmentar: quanto de massa magra e de gordura tem em cada parte.
 *
 * A silhueta é SVG à mão. Poderia ser uma imagem, mas aí ela não acompanharia
 * o tema claro/escuro e pesaria no cache offline — e o que importa aqui são os
 * cinco números, não o desenho.
 *
 * Client Component só por causa do alternador magra/gordura.
 */

export function Segmentar({
  magra,
  gordura,
  anterior,
}: {
  magra: Segmento | null;
  gordura: Segmento | null;
  /** O mesmo bloco do exame anterior, pra mostrar a variação. */
  anterior?: { magra: Segmento | null; gordura: Segmento | null };
}) {
  const [modo, setModo] = useState<"magra" | "gordura">("magra");
  const atual = modo === "magra" ? magra : gordura;
  const antes = modo === "magra" ? anterior?.magra : anterior?.gordura;

  if (!magra && !gordura) return null;

  const fmt = (n: number | null) =>
    n == null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;

  return (
    <section className="rounded-2xl bg-card border border-border p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted">Análise segmentar</p>

      <div className="mt-2 flex gap-2">
        {(["magra", "gordura"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            disabled={m === "magra" ? !magra : !gordura}
            className={`flex-1 rounded-xl border py-2.5 text-xs disabled:opacity-40 ${
              modo === m
                ? "bg-accent text-black border-accent font-medium"
                : "bg-background border-border text-muted"
            }`}
          >
            {m === "magra" ? "Massa magra" : "Gordura"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-5 items-center">
        <Lado
          rotulo="Braço direito"
          valor={atual?.bracoDireito ?? null}
          antes={antes?.bracoDireito ?? null}
          fmt={fmt}
          alinhar="left"
        />
        <Silhueta />
        <Lado
          rotulo="Braço esquerdo"
          valor={atual?.bracoEsquerdo ?? null}
          antes={antes?.bracoEsquerdo ?? null}
          fmt={fmt}
          alinhar="right"
        />

        <Lado
          rotulo="Perna direita"
          valor={atual?.pernaDireita ?? null}
          antes={antes?.pernaDireita ?? null}
          fmt={fmt}
          alinhar="left"
        />
        <Lado
          rotulo="Tronco"
          valor={atual?.tronco ?? null}
          antes={antes?.tronco ?? null}
          fmt={fmt}
          alinhar="center"
        />
        <Lado
          rotulo="Perna esquerda"
          valor={atual?.pernaEsquerda ?? null}
          antes={antes?.pernaEsquerda ?? null}
          fmt={fmt}
          alinhar="right"
        />
      </div>
    </section>
  );
}

function Lado({
  rotulo,
  valor,
  antes,
  fmt,
  alinhar,
}: {
  rotulo: string;
  valor: number | null;
  antes: number | null;
  fmt: (n: number | null) => string;
  alinhar: "left" | "right" | "center";
}) {
  const delta = valor != null && antes != null ? Math.round((valor - antes) * 100) / 100 : null;
  const alinha =
    alinhar === "left" ? "text-left" : alinhar === "right" ? "text-right" : "text-center";

  return (
    <div className={alinha}>
      <p className="text-[10px] text-muted leading-tight">{rotulo}</p>
      <p className="text-lg tabular-nums leading-tight">{fmt(valor)}</p>
      {delta != null && delta !== 0 && (
        <p className={`text-[10px] tabular-nums ${delta > 0 ? "text-accent" : "text-amber-400"}`}>
          {delta > 0 ? "+" : ""}
          {delta.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
        </p>
      )}
    </div>
  );
}

/** Silhueta genérica — só referência visual de onde cada número fica. */
function Silhueta() {
  return (
    <svg viewBox="0 0 40 96" className="h-40 w-16 row-span-2" aria-hidden>
      <g fill="var(--border)">
        <circle cx="20" cy="8" r="6" />
        <rect x="13" y="16" width="14" height="26" rx="5" />
        <rect x="4" y="18" width="7" height="26" rx="3.5" />
        <rect x="29" y="18" width="7" height="26" rx="3.5" />
        <rect x="13" y="44" width="6" height="40" rx="3" />
        <rect x="21" y="44" width="6" height="40" rx="3" />
      </g>
    </svg>
  );
}
